import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, notifications } from "@workspace/db";
import { getSchoolId, getSchoolSettings, getStudent, listStudents, listUsers } from "./school-data";
import type { OperationRecord, SchoolStudent, SchoolUser } from "./school-data";
import { logger } from "./logger";
import { compactSingleSegmentSms } from "./single-segment-sms";
import { isYoolaSmsConfigured, normalizeYoolaPhone, sendYoolaSms } from "./yoola-sms";
import { isAmbiguousSmsFailure, reserveSmsMessages, settleSmsMessages } from "./sms-allowance-policy";
import type { SmsQuotaBalance } from "./sms-allowance-policy";

const SCHOOL_TIME_ZONE = "Africa/Kampala";
const FEE_REMINDER_HOUR = 9;
const FEE_REMINDER_BATCH_SIZE = 100;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type SmsChannel = "payment_confirmation" | "announcement" | "event" | "fee_reminder" | "direct_message";
type SmsPayment = {
  id: string;
  studentId: string;
  receiptNumber: string;
  studentName: string;
  amount: number;
  balance: number;
  status?: string;
};
type DirectMessageRecipient = { id: string; name: string; detail: string; phone: string };
type DirectMessagePupil = { id: string; name: string; detail: string; phone?: string };
type SmsDispatchSummary = {
  recipientCount: number;
  acceptedCount: number;
  failedCount: number;
  duplicateCount: number;
  disabled: boolean;
  quotaExceeded: boolean;
};
export type SmsAllowanceBalance = SmsQuotaBalance;

function smsAllowanceId(schoolId: string): string {
  return deterministicUuid(`${schoolId}:school-system:sms-allowance`);
}

function readAllowance(data: Record<string, unknown> | undefined): SmsAllowanceBalance {
  if (!data) return { availableMessages: 0, reservedMessages: 0, sentMessages: 0 };
  if (data["recordType"] !== "sms_allowance") throw new Error("SMS allowance data is invalid.");
  const values = [data["availableMessages"], data["reservedMessages"], data["sentMessages"]];
  if (values.some((value) => typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("SMS allowance data is invalid.");
  }
  return {
    availableMessages: values[0] as number,
    reservedMessages: values[1] as number,
    sentMessages: values[2] as number,
  };
}

type SmsDbSession = Pick<typeof db, "insert" | "select" | "update">;
async function lockedAllowance(tx: SmsDbSession): Promise<{ id: string; schoolId: string; data: Record<string, unknown> }> {
  const schoolId = await getSchoolId();
  const id = smsAllowanceId(schoolId);
  await tx.insert(notifications).values({
    id,
    schoolId,
    data: { smsDelivery: true, recordType: "sms_allowance", availableMessages: 0, reservedMessages: 0, sentMessages: 0 },
  }).onConflictDoNothing({ target: notifications.id });
  const row = (await tx.select({ data: notifications.data }).from(notifications).where(and(
    eq(notifications.id, id),
    eq(notifications.schoolId, schoolId),
  )).for("update").limit(1))[0];
  if (!row) throw new Error("SMS allowance could not be checked.");
  readAllowance(row.data);
  return { id, schoolId, data: row.data };
}

export async function getSmsAllowanceBalance(): Promise<SmsAllowanceBalance> {
  const schoolId = await getSchoolId();
  const row = (await db.select({ data: notifications.data }).from(notifications).where(and(
    eq(notifications.id, smsAllowanceId(schoolId)),
    eq(notifications.schoolId, schoolId),
  )).limit(1))[0];
  return readAllowance(row?.data);
}

export async function getSupportSmsAllowance() {
  const [schoolId, settings, balance] = await Promise.all([getSchoolId(), getSchoolSettings(), getSmsAllowanceBalance()]);
  const rows = await db.select({ data: notifications.data, createdAt: notifications.createdAt }).from(notifications).where(and(
    eq(notifications.schoolId, schoolId),
    sql`${notifications.data}->>'recordType' = 'sms_allowance_audit'`,
  )).orderBy(desc(notifications.createdAt)).limit(100);
  const adjustments = rows.flatMap((row) => {
    const data = row.data;
    if (data["recordType"] !== "sms_allowance_audit") return [];
    if (typeof data["messages"] !== "number" || typeof data["note"] !== "string" || typeof data["actor"] !== "string") return [];
    return [{
      messages: data["messages"],
      note: data["note"],
      actor: data["actor"],
      occurredAt: row.createdAt.toISOString(),
    }];
  });
  return { ...balance, schoolName: settings.schoolName, adjustments };
}

export async function adjustSmsAllowance(messages: number, note: string, actorId: string, actorName = "Corenexa Support"): Promise<void> {
  if (!Number.isSafeInteger(messages) || messages === 0 || Math.abs(messages) > 1_000_000) {
    throw new Error("Enter a non-zero whole-number SMS adjustment.");
  }
  if (!note.trim()) throw new Error("An audit note is required for this adjustment.");
  await db.transaction(async (tx) => {
    const allowance = await lockedAllowance(tx);
    const current = readAllowance(allowance.data);
    if (current.availableMessages + messages < 0) throw new Error("The adjustment cannot reduce the remaining SMS balance below zero.");
    const now = new Date();
    await tx.update(notifications).set({
      data: { ...allowance.data, availableMessages: current.availableMessages + messages },
      updatedAt: now,
    }).where(and(eq(notifications.id, allowance.id), eq(notifications.schoolId, allowance.schoolId)));
    await tx.insert(notifications).values({
      id: randomUUID(),
      schoolId: allowance.schoolId,
      data: {
        smsDelivery: true,
        recordType: "sms_allowance_audit",
        messages,
        note: note.trim(),
        actor: actorName,
        actorId,
        occurredAt: now.toISOString(),
      },
      createdAt: now,
      updatedAt: now,
    });
  });
}

export async function listSmsDeliveriesForReconciliation() {
  const schoolId = await getSchoolId();
  const stuckBefore = new Date(Date.now() - 2 * 60 * 1000);
  const [rows, auditRows] = await Promise.all([
    db.select({ id: notifications.id, data: notifications.data, createdAt: notifications.createdAt }).from(notifications).where(and(
      eq(notifications.schoolId, schoolId),
      sql`${notifications.data}->>'recordType' = 'sms_delivery'`,
      sql`${notifications.data}->>'smsDelivery' = 'true'`,
      sql`${notifications.data}->>'status' in ('sending', 'reconciliation_required')`,
    )).orderBy(desc(notifications.createdAt)),
    db.select({ data: notifications.data, createdAt: notifications.createdAt }).from(notifications).where(and(
      eq(notifications.schoolId, schoolId),
      sql`${notifications.data}->>'recordType' = 'sms_delivery_reconciliation'`,
    )).orderBy(desc(notifications.createdAt)).limit(50),
  ]);
  const resolutions = auditRows.flatMap((row) => {
    const data = row.data;
    if (
      typeof data["deliveryId"] !== "string"
      || (data["outcome"] !== "sent" && data["outcome"] !== "failed")
      || typeof data["messages"] !== "number"
      || !Number.isSafeInteger(data["messages"])
      || data["messages"] < 1
      || typeof data["note"] !== "string"
      || typeof data["actor"] !== "string"
    ) return [];
    return [{
      deliveryId: data["deliveryId"],
      outcome: data["outcome"],
      messages: data["messages"],
      note: data["note"],
      actor: data["actor"],
      occurredAt: row.createdAt.toISOString(),
    }];
  });
  return {
    resolutions,
    deliveries: rows.flatMap((row) => {
      const data = row.data;
      const status = data["status"];
      const recipientCount = data["recipientCount"];
      if ((status !== "reconciliation_required" && (status !== "sending" || row.createdAt > stuckBefore))
        || typeof data["channel"] !== "string"
        || typeof recipientCount !== "number"
        || !Number.isSafeInteger(recipientCount)
        || recipientCount < 1) return [];
      return [{
        id: row.id,
        channel: data["channel"],
        recipientCount,
        status: status as "sending" | "reconciliation_required",
        occurredAt: row.createdAt.toISOString(),
        ...(typeof data["failureCode"] === "string" ? { failureCode: data["failureCode"] } : {}),
      }];
    }),
  };
}

export async function markSmsDeliveryForReconciliation(
  reservation: { id: string; schoolId: string },
  failureCode: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockedAllowance(tx);
    const row = (await tx.select({ data: notifications.data }).from(notifications).where(and(
      eq(notifications.id, reservation.id),
      eq(notifications.schoolId, reservation.schoolId),
    )).for("update").limit(1))[0];
    if (!row || row.data["status"] !== "sending") return;
    await tx.update(notifications).set({
      data: { ...row.data, status: "reconciliation_required", failureCode },
      updatedAt: new Date(),
    }).where(and(
      eq(notifications.id, reservation.id),
      eq(notifications.schoolId, reservation.schoolId),
    ));
  });
}

export async function reconcileSmsDelivery(
  deliveryId: string,
  outcome: "sent" | "failed",
  note: string,
  actor: string,
): Promise<void> {
  if (!note.trim()) throw new Error("An audit note is required for delivery reconciliation.");
  const schoolId = await getSchoolId();
  await db.transaction(async (tx) => {
    const allowance = await lockedAllowance(tx);
    const row = (await tx.select({ data: notifications.data }).from(notifications).where(and(
      eq(notifications.id, deliveryId),
      eq(notifications.schoolId, schoolId),
    )).for("update").limit(1))[0];
    if (row?.data["recordType"] !== "sms_delivery" || !["sending", "reconciliation_required"].includes(String(row.data["status"]))) {
      throw new Error("This SMS delivery is no longer awaiting reconciliation.");
    }
    const reservedMessages = row.data["reservedMessages"];
    if (typeof reservedMessages !== "number" || !Number.isSafeInteger(reservedMessages) || reservedMessages < 1) {
      throw new Error("The SMS reservation data is invalid and cannot be reconciled.");
    }
    const balance = readAllowance(allowance.data);
    const settledBalance = settleSmsMessages(balance, reservedMessages, outcome);
    const now = new Date();
    await tx.update(notifications).set({
      data: {
        ...allowance.data,
        ...settledBalance,
      },
      updatedAt: now,
    }).where(and(eq(notifications.id, allowance.id), eq(notifications.schoolId, schoolId)));
    await tx.update(notifications).set({
      data: {
        ...row.data,
        status: outcome,
        reconciledAt: now.toISOString(),
        reconciledBy: actor,
        reconciliationNote: note.trim(),
      },
      updatedAt: now,
    }).where(and(eq(notifications.id, deliveryId), eq(notifications.schoolId, schoolId)));
    await tx.insert(notifications).values({
      id: randomUUID(),
      schoolId,
      data: {
        smsDelivery: true,
        recordType: "sms_delivery_reconciliation",
        deliveryId,
        outcome,
        messages: reservedMessages,
        note: note.trim(),
        actor: "Corenexa Support",
        actorId: actor,
        occurredAt: now.toISOString(),
      },
      createdAt: now,
      updatedAt: now,
    });
  });
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicUuid(value: string): string {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function feeReminderAuthorizationId(schoolId: string): string {
  return deterministicUuid(`${schoolId}:school-system:fee-reminder-sms-authorization`);
}

export async function getFeeReminderSmsAuthorization(): Promise<boolean> {
  const schoolId = await getSchoolId();
  const row = (await db.select({ data: notifications.data }).from(notifications).where(and(
    eq(notifications.id, feeReminderAuthorizationId(schoolId)),
    eq(notifications.schoolId, schoolId),
  )).limit(1))[0];
  return row?.data["recordType"] === "fee_reminder_sms_authorization"
    && row.data["authorized"] === true;
}

export async function setFeeReminderSmsAuthorization(
  authorized: boolean,
  actorId: string,
): Promise<{ authorized: boolean }> {
  const schoolId = await getSchoolId();
  const id = feeReminderAuthorizationId(schoolId);
  const now = new Date();
  await db.insert(notifications).values({
    id,
    schoolId,
    data: {
      smsDelivery: true,
      recordType: "fee_reminder_sms_authorization",
      channel: "fee_reminder",
      authorized,
      authorizedBy: actorId,
      authorizedAt: authorized ? now.toISOString() : null,
    },
  }).onConflictDoUpdate({
    target: notifications.id,
    set: {
      data: {
        smsDelivery: true,
        recordType: "fee_reminder_sms_authorization",
        channel: "fee_reminder",
        authorized,
        authorizedBy: actorId,
        authorizedAt: authorized ? now.toISOString() : null,
      },
      updatedAt: now,
    },
  });
  return { authorized };
}

async function reserveSmsDelivery(
  deliveryKey: string,
  channel: SmsChannel,
  recipientCount: number,
  actorId?: string,
): Promise<{ reservation?: { id: string; schoolId: string }; duplicate?: true; quotaExceeded?: true }> {
  const schoolId = await getSchoolId();
  const id = deterministicUuid(`${schoolId}:${deliveryKey}`);
  return db.transaction(async (tx) => {
    const allowance = await lockedAllowance(tx);
    const existing = (await tx.select({ id: notifications.id }).from(notifications).where(and(
      eq(notifications.id, id),
      eq(notifications.schoolId, schoolId),
    )).limit(1))[0];
    if (existing) return { duplicate: true };
    const balance = readAllowance(allowance.data);
    const reservedBalance = reserveSmsMessages(balance, recipientCount);
    if (!reservedBalance) return { quotaExceeded: true };
    await tx.update(notifications).set({
      data: {
        ...allowance.data,
        ...reservedBalance,
      },
      updatedAt: new Date(),
    }).where(and(eq(notifications.id, allowance.id), eq(notifications.schoolId, schoolId)));
    await tx.insert(notifications).values({
      id,
      schoolId,
      data: {
        smsDelivery: true,
        recordType: "sms_delivery",
        provider: "yoola",
        channel,
        status: "sending",
        deliveryKeyHash: hash(deliveryKey),
        recipientCount,
        reservedMessages: recipientCount,
        ...(actorId ? { initiatedBy: actorId } : {}),
      },
    });
    return { reservation: { id, schoolId } };
  });
}

async function finishSmsDelivery(
  reservation: { id: string; schoolId: string },
  result: { status: "sent" | "failed"; messageId?: string; reason?: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const allowance = await lockedAllowance(tx);
    const row = (await tx.select({ data: notifications.data }).from(notifications).where(and(
      eq(notifications.id, reservation.id),
      eq(notifications.schoolId, reservation.schoolId),
    )).for("update").limit(1))[0];
    if (!row || row.data["status"] !== "sending") return;
    const reservedMessages = row.data["reservedMessages"];
    if (typeof reservedMessages !== "number" || !Number.isSafeInteger(reservedMessages) || reservedMessages < 0) {
      throw new Error("SMS reservation data is invalid.");
    }
    const balance = readAllowance(allowance.data);
    const settledBalance = settleSmsMessages(balance, reservedMessages, result.status);
    const now = new Date();
    await tx.update(notifications).set({
      data: {
        ...allowance.data,
        ...settledBalance,
      },
      updatedAt: now,
    }).where(and(eq(notifications.id, allowance.id), eq(notifications.schoolId, reservation.schoolId)));
    await tx.update(notifications).set({
      data: {
        ...row.data,
        status: result.status,
        ...(result.status === "sent" ? { sentAt: now.toISOString() } : {}),
        ...(result.messageId ? { providerMessageId: result.messageId } : {}),
        ...(result.reason ? { failureCode: result.reason } : {}),
      },
      updatedAt: now,
    }).where(and(eq(notifications.id, reservation.id), eq(notifications.schoolId, reservation.schoolId)));
  });
}

async function dispatchSms(
  channel: SmsChannel,
  deliveryKey: string,
  rawPhones: string[],
  rawMessage: string,
  actorId?: string,
): Promise<SmsDispatchSummary> {
  const message = compactSingleSegmentSms(rawMessage);
  const phones = [...new Set(rawPhones.map(normalizeYoolaPhone).filter((phone): phone is string => Boolean(phone)))].sort();
  const summary: SmsDispatchSummary = {
    recipientCount: phones.length,
    acceptedCount: 0,
    failedCount: 0,
    duplicateCount: 0,
    disabled: false,
    quotaExceeded: false,
  };
  if (!message || !phones.length) return summary;
  if (!isYoolaSmsConfigured()) return { ...summary, disabled: true };

  for (let offset = 0; offset < phones.length; offset += FEE_REMINDER_BATCH_SIZE) {
    const batch = phones.slice(offset, offset + FEE_REMINDER_BATCH_SIZE);
    const batchKey = `${channel}:${deliveryKey}:${hash(batch.join(","))}`;
    let reservation: { id: string; schoolId: string } | undefined;
    try {
      const reserved = await reserveSmsDelivery(batchKey, channel, batch.length, actorId);
      reservation = reserved.reservation;
      if (reserved.duplicate) {
        summary.duplicateCount += batch.length;
        continue;
      }
      if (reserved.quotaExceeded) {
        summary.failedCount += batch.length;
        summary.quotaExceeded = true;
        logger.warn({ channel, recipientCount: batch.length }, "SMS allowance exhausted; outgoing SMS batch was blocked");
        continue;
      }
    } catch {
      summary.failedCount += batch.length;
      logger.error({ channel, recipientCount: batch.length }, "Could not reserve Yoola SMS delivery; message not sent");
      continue;
    }
    if (!reservation) {
      summary.failedCount += batch.length;
      logger.error({ channel, recipientCount: batch.length }, "SMS reservation returned no reservation; message not sent");
      continue;
    }

    let result: Awaited<ReturnType<typeof sendYoolaSms>>;
    try {
      result = await sendYoolaSms(batch, message);
    } catch {
      summary.failedCount += batch.length;
      try {
        await markSmsDeliveryForReconciliation(reservation, "dispatcher_exception");
      } catch {
        logger.error({ channel, recipientCount: batch.length }, "Thrown Yoola dispatcher left a reservation for reconciliation");
      }
      logger.error({ channel, recipientCount: batch.length }, "Yoola dispatcher threw; reservation held for outcome reconciliation");
      continue;
    }
    if (result.status === "sent") {
      summary.acceptedCount += result.recipientCount;
      try {
        await finishSmsDelivery(reservation, result);
      } catch {
        try {
          await markSmsDeliveryForReconciliation(reservation, "finalization_failed_after_provider_acceptance");
        } catch {
          logger.error({ channel, recipientCount: batch.length }, "Accepted Yoola batch remains reserved and will require reconciliation");
        }
        logger.error({ channel, recipientCount: batch.length }, "Yoola accepted an SMS batch but its delivery record could not be updated");
      }
      continue;
    }

    const failureCode = result.status === "failed" ? result.reason : result.status;
    if (result.status === "disabled") summary.disabled = true;
    else summary.failedCount += batch.length;
    const ambiguousFailure = result.status === "failed" && isAmbiguousSmsFailure(result.reason);
    if (ambiguousFailure) {
      try {
        await markSmsDeliveryForReconciliation(reservation, result.status === "failed" ? result.reason : "ambiguous_provider_result");
      } catch {
        logger.error({ channel, recipientCount: batch.length }, "Ambiguous Yoola result remains reserved and will require reconciliation");
      }
      logger.warn({ channel, recipientCount: batch.length, reason: failureCode }, "Yoola outcome is ambiguous; reservation held to prevent duplicate sends or refunds");
      continue;
    }
    try {
      await finishSmsDelivery(reservation, { status: "failed", reason: failureCode });
    } catch {
      try {
        await markSmsDeliveryForReconciliation(reservation, `finalization_failed_${failureCode}`);
      } catch {
        logger.error({ channel, recipientCount: batch.length }, "Failed Yoola result remains reserved and will require reconciliation");
      }
      logger.error({ channel, recipientCount: batch.length }, "Yoola SMS failure status could not be saved");
    }
    logger.warn({ channel, recipientCount: batch.length, reason: failureCode }, "Yoola SMS batch failed; automatic retry suppressed");
  }
  return summary;
}

function guardianAccountPhone(studentId: string, users: SchoolUser[]): string | undefined {
  const account = users.find((user) =>
    user.role === "guardian"
    && user.status === "active"
    && user.studentId === studentId
    && user.phone.trim(),
  );
  return account ? normalizeYoolaPhone(account.phone) : undefined;
}

function guardianPhone(student: SchoolStudent, users: SchoolUser[]): string | undefined {
  return normalizeYoolaPhone(student.guardianPhone) || guardianAccountPhone(student.id, users);
}

function activeGuardianPhones(students: SchoolStudent[], users: SchoolUser[]): string[] {
  return [...new Set(students
    .filter((student) => student.status === "active")
    .map((student) => guardianPhone(student, users))
    .filter((phone): phone is string => Boolean(phone)))];
}

function activeStaffPhones(users: SchoolUser[], roles?: string[]): string[] {
  return [...new Set(users
    .filter((user) =>
      user.status === "active"
      && user.userType === "staff"
      && (!roles || roles.includes(user.role))
      && user.phone.trim(),
    )
    .map((user) => normalizeYoolaPhone(user.phone))
    .filter((phone): phone is string => Boolean(phone)))];
}

function directMessageRecipients(
  students: SchoolStudent[],
  users: SchoolUser[],
  schoolId: string,
): { teachers: DirectMessageRecipient[]; parents: DirectMessageRecipient[]; pupils: DirectMessagePupil[] } {
  const teachers = users.flatMap((user) => {
    if (user.status !== "active" || user.userType !== "staff" || user.role !== "teacher") return [];
    const phone = normalizeYoolaPhone(user.phone);
    if (!phone) return [];
    return [{
      id: user.id,
      name: user.name.trim() || "Teacher",
      detail: user.department?.trim() || "Teacher",
      phone,
    }];
  });
  const pupils = students.map((student): DirectMessagePupil => {
    const phone = guardianPhone(student, users);
    const classLabel = `${student.className}${student.stream ? ` · ${student.stream}` : ""}`;
    const fundingLabel = student.isSponsored ? "School-sponsored" : "Fee-paying";
    const contactLabel = phone ? "Guardian contact available" : "No usable guardian number";
    return {
      id: student.id,
      name: student.name,
      detail: `${student.registrationNumber} · ${classLabel} · Guardian: ${student.guardianName.trim() || "Not recorded"} · ${fundingLabel} · ${student.status} · ${contactLabel}`,
      ...(phone ? { phone } : {}),
    };
  });
  const guardiansByPhone = new Map<string, { guardianNames: Set<string>; pupilNames: Set<string> }>();
  for (const student of students) {
    const phone = guardianPhone(student, users);
    if (!phone) continue;
    const group = guardiansByPhone.get(phone) ?? { guardianNames: new Set<string>(), pupilNames: new Set<string>() };
    if (student.guardianName.trim()) group.guardianNames.add(student.guardianName.trim());
    group.pupilNames.add(student.name.trim() || "Active pupil");
    guardiansByPhone.set(phone, group);
  }
  const parents = [...guardiansByPhone.entries()].map(([phone, group]): DirectMessageRecipient => {
    const pupilNames = [...group.pupilNames].sort((left, right) => left.localeCompare(right));
    const guardianNames = [...group.guardianNames].sort((left, right) => left.localeCompare(right));
    const additionalPupils = pupilNames.length - 3;
    const pupilSummary = `${pupilNames.slice(0, 3).join(", ")}${additionalPupils > 0 ? `, +${additionalPupils} more` : ""}`;
    return {
      id: deterministicUuid(`${schoolId}:direct-message-parent:${phone}`),
      name: guardianNames.join(" / ") || `Parent/guardian of ${pupilNames[0] || "active pupil"}`,
      detail: `Parent/guardian of ${pupilSummary}`,
      phone,
    };
  });
  const byName = (left: DirectMessageRecipient, right: DirectMessageRecipient) => left.name.localeCompare(right.name);
  return {
    teachers: teachers.sort(byName),
    parents: parents.sort(byName),
    pupils: pupils.sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export async function listMessageRecipients(): Promise<{
  teachers: Array<{ id: string; name: string; detail: string }>;
  parents: Array<{ id: string; name: string; detail: string }>;
  pupils: Array<{ id: string; name: string; detail: string; canSend: boolean }>;
}> {
  const [students, users, schoolId] = await Promise.all([listStudents(), listUsers(), getSchoolId()]);
  const contacts = directMessageRecipients(students, users, schoolId);
  return {
    teachers: contacts.teachers.map(({ id, name, detail }) => ({ id, name, detail })),
    parents: contacts.parents.map(({ id, name, detail }) => ({ id, name, detail })),
    pupils: contacts.pupils.map(({ id, name, detail, phone }) => ({ id, name, detail, canSend: Boolean(phone) })),
  };
}

export async function sendDirectSchoolMessage(
  input: { requestId: string; teacherIds: string[]; parentIds: string[]; pupilIds: string[]; message: string },
  actorId: string,
): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      result: {
        status: "accepted" | "partial" | "failed" | "disabled" | "duplicate";
        recipientCount: number;
        acceptedCount: number;
        failedCount: number;
        duplicateCount: number;
        quotaExceeded: boolean;
      };
    }
> {
  if (!UUID_PATTERN.test(input.requestId)) return { ok: false, error: "Invalid send request. Refresh the page and try again." };
  const teacherIds = [...new Set(input.teacherIds)];
  const parentIds = [...new Set(input.parentIds)];
  const pupilIds = [...new Set(input.pupilIds)];
  if (!teacherIds.length && !parentIds.length && !pupilIds.length) return { ok: false, error: "Select at least one teacher, pupil, or parent/guardian." };

  const [students, users, settings, schoolId] = await Promise.all([
    listStudents(),
    listUsers(),
    getSchoolSettings(),
    getSchoolId(),
  ]);
  const contacts = directMessageRecipients(students, users, schoolId);
  const teachersById = new Map(contacts.teachers.map((recipient) => [recipient.id, recipient]));
  const parentsById = new Map(contacts.parents.map((recipient) => [recipient.id, recipient]));
  const pupilsById = new Map(contacts.pupils.map((recipient) => [recipient.id, recipient]));
  const selectedTeachers = teacherIds.map((id) => teachersById.get(id));
  const selectedParents = parentIds.map((id) => parentsById.get(id));
  const selectedPupils = pupilIds.map((id) => pupilsById.get(id));
  if (
    selectedTeachers.some((recipient) => !recipient)
    || selectedParents.some((recipient) => !recipient)
    || selectedPupils.some((recipient) => !recipient?.phone)
  ) {
    return { ok: false, error: "Some contacts changed or no longer have a usable phone number. Refresh the recipient list and try again." };
  }

  const schoolName = settings.schoolName.replace(/\s+/gu, " ").trim();
  if (!schoolName) return { ok: false, error: "Add the school name in Settings before sending branded messages." };
  const messageText = input.message.replace(/\s+/gu, " ").trim();
  if (!messageText) return { ok: false, error: "Enter a message to send." };
  const brandedMessage = `${schoolName}: ${messageText}`;
  if (compactSingleSegmentSms(brandedMessage) !== brandedMessage) {
    return { ok: false, error: "Shorten the message to fit one SMS segment, including the school name." };
  }

  const phones = [
    ...selectedTeachers.flatMap((recipient) => recipient ? [recipient.phone] : []),
    ...selectedParents.flatMap((recipient) => recipient ? [recipient.phone] : []),
    ...selectedPupils.flatMap((recipient) => recipient?.phone ? [recipient.phone] : []),
  ];
  const summary = await dispatchSms(
    "direct_message",
    `direct-message:${actorId}:${input.requestId}`,
    phones,
    brandedMessage,
    actorId,
  );
  const status = summary.acceptedCount === summary.recipientCount && summary.recipientCount > 0
    ? "accepted"
    : summary.acceptedCount > 0
      ? "partial"
      : summary.disabled
        ? "disabled"
        : summary.duplicateCount > 0 && summary.failedCount === 0
          ? "duplicate"
          : "failed";
  return {
    ok: true,
    result: {
      status,
      recipientCount: summary.recipientCount,
      acceptedCount: summary.acceptedCount,
      failedCount: summary.failedCount,
      duplicateCount: summary.duplicateCount,
      quotaExceeded: summary.quotaExceeded,
    },
  };
}

function normalizeAudience(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}

function announcementRecipients(
  audience: string,
  students: SchoolStudent[],
  users: SchoolUser[],
): string[] {
  const audienceKey = normalizeAudience(audience);
  const allSchool = ["everyone", "entire school", "whole school", "all"].includes(audienceKey);
  const classStudents = students.filter((student) => {
    const classAndStream = `${student.className} ${student.stream}`.trim();
    return normalizeAudience(student.className) === audienceKey
      || normalizeAudience(classAndStream) === audienceKey;
  });
  const targetsGuardians = allSchool
    || /parent|guardian|pupil|student/iu.test(audienceKey)
    || classStudents.length > 0;
  const guardianPhones = targetsGuardians
    ? activeGuardianPhones(classStudents.length ? classStudents : students, users)
    : [];

  let staffRoles: string[] | undefined;
  if (allSchool || audienceKey === "staff") {
    staffRoles = undefined;
  } else if (/teacher/iu.test(audienceKey) || audienceKey === "students") {
    staffRoles = ["teacher"];
  } else if (/accountant/iu.test(audienceKey)) {
    staffRoles = ["accountant"];
  } else if (/secretary/iu.test(audienceKey)) {
    staffRoles = ["secretary"];
  } else if (/nurse/iu.test(audienceKey)) {
    staffRoles = ["nurse"];
  } else if (/librarian/iu.test(audienceKey)) {
    staffRoles = ["librarian"];
  } else if (targetsGuardians && !allSchool) {
    staffRoles = undefined;
  } else {
    staffRoles = [];
  }
  const staffPhones = allSchool || audienceKey === "staff" || staffRoles?.length
    ? activeStaffPhones(users, staffRoles)
    : [];
  return [...new Set([...guardianPhones, ...staffPhones])];
}

function formatAmount(amount: number): string {
  return Math.max(0, Number(amount) || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export async function sendPaymentConfirmationSms(
  payment: SmsPayment,
  student?: SchoolStudent,
): Promise<void> {
  try {
    if (payment.status && payment.status !== "completed") return;
    const pupil = student ?? await getStudent(payment.studentId);
    if (!pupil) return;
    const phone = guardianPhone(pupil, await listUsers());
    if (!phone) return;
    const settings = await getSchoolSettings();
    const message = `EMMECTY receipt ${payment.receiptNumber}: ${settings.currencyCode} ${formatAmount(payment.amount)} paid. Balance ${settings.currencyCode} ${formatAmount(payment.balance)}.`;
    await dispatchSms("payment_confirmation", `payment:${payment.id}`, [phone], message);
  } catch {
    logger.warn({ paymentId: payment.id }, "Payment was saved but its Yoola confirmation could not be sent");
  }
}

export async function sendAnnouncementSms(announcement: OperationRecord): Promise<void> {
  try {
    const [students, users] = await Promise.all([listStudents(), listUsers()]);
    const audience = String(announcement["audience"] ?? "");
    const phones = announcementRecipients(audience, students, users);
    const title = String(announcement["title"] ?? "School announcement").trim();
    const body = String(announcement["body"] ?? "").trim();
    const prefix = announcement["priority"] === "important" ? "Important: " : "";
    const message = `EMMECTY: ${prefix}${title}. ${body}`;
    await dispatchSms("announcement", `announcement:${announcement.id}`, phones, message);
  } catch {
    logger.warn({ announcementId: announcement.id }, "Announcement was published but its Yoola SMS could not be sent");
  }
}

export async function sendEventSms(event: OperationRecord): Promise<void> {
  try {
    if (/cancel|draft/iu.test(String(event["status"] ?? ""))) return;
    const [students, users] = await Promise.all([listStudents(), listUsers()]);
    const phones = [...new Set([...activeGuardianPhones(students, users), ...activeStaffPhones(users)])];
    const title = String(event["title"] ?? "School event").trim();
    const type = String(event["type"] ?? "School event").trim();
    const date = String(event["date"] ?? "").trim();
    const location = String(event["location"] ?? "").trim();
    const message = `EMMECTY: ${type} ${title}${date ? ` on ${date}` : ""}${location ? ` at ${location}` : ""}.`;
    await dispatchSms("event", `event:${event.id}`, phones, message);
  } catch {
    logger.warn({ eventId: event.id }, "Event was saved but its Yoola SMS could not be sent");
  }
}

function kampalaDateParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute"), second: read("second") };
}

function feeReminderMonthKey(date: Date): string {
  const { year, month } = kampalaDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function sendMonthlyFeeBalanceReminders(now = new Date()): Promise<void> {
  if (!isYoolaSmsConfigured()) return;
  try {
    if (!await getFeeReminderSmsAuthorization()) return;
    const [students, users, settings] = await Promise.all([listStudents(), listUsers(), getSchoolSettings()]);
    const groups = new Map<string, { total: number; pupilCount: number }>();
    for (const student of students) {
      if (
        student.status !== "active"
        || student.isSponsored
        || student.feeBalance <= 0
      ) continue;
      const phone = guardianPhone(student, users);
      if (!phone) continue;
      const current = groups.get(phone) ?? { total: 0, pupilCount: 0 };
      current.total += student.feeBalance;
      current.pupilCount += 1;
      groups.set(phone, current);
    }

    const monthKey = feeReminderMonthKey(now);
    const entries = [...groups.entries()];
    const concurrency = 4;
    for (let offset = 0; offset < entries.length; offset += concurrency) {
      if (!await getFeeReminderSmsAuthorization()) break;
      await Promise.all(entries.slice(offset, offset + concurrency).map(async ([phone, summary]) => {
        const pupilLabel = summary.pupilCount === 1 ? "pupil" : "pupils";
        const message = `EMMECTY: ${settings.currencyCode} ${formatAmount(summary.total)} remains due for ${summary.pupilCount} ${pupilLabel}. Please contact the school office if paid.`;
        await dispatchSms(
          "fee_reminder",
          `fee-reminder:${monthKey}:${hash(phone)}`,
          [phone],
          message,
        );
      }));
    }
  } catch {
    logger.error({ monthKey: feeReminderMonthKey(now) }, "Monthly Yoola fee reminders could not be processed");
  }
}

function millisecondsUntilNextMonthFirstAtNine(now: Date): number {
  const { year, month, day, hour, minute, second } = kampalaDateParts(now);
  let targetYear = year;
  let targetMonth = month;
  if (day > 1 || hour > FEE_REMINDER_HOUR || (hour === FEE_REMINDER_HOUR && (minute > 0 || second > 0))) {
    targetMonth += 1;
    if (targetMonth > 12) {
      targetMonth = 1;
      targetYear += 1;
    }
  }
  const targetUtc = Date.UTC(targetYear, targetMonth - 1, 1, 6, 0, 0);
  return Math.max(1_000, targetUtc - now.getTime());
}

export function startMonthlyFeeReminderScheduler(): void {
  if (!isYoolaSmsConfigured()) {
    logger.info("Yoola SMS is not configured; outbound SMS remains disabled");
  }

  const scheduleNext = () => {
    const timer = setTimeout(async () => {
      try {
        await sendMonthlyFeeBalanceReminders();
      } finally {
        scheduleNext();
      }
    }, millisecondsUntilNextMonthFirstAtNine(new Date()));
    timer.unref?.();
  };

  scheduleNext();
  logger.info(
    { timeZone: SCHOOL_TIME_ZONE, dayOfMonth: 1, hour: FEE_REMINDER_HOUR, authorizationRequired: true },
    "Monthly Yoola fee reminders scheduled",
  );
}