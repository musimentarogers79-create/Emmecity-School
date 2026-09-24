import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, notifications } from "@workspace/db";
import { getSchoolId, getSchoolSettings, getStudent, listStudents, listUsers } from "./school-data";
import type { OperationRecord, SchoolStudent, SchoolUser } from "./school-data";
import { logger } from "./logger";
import { compactSingleSegmentSms } from "./single-segment-sms";
import { isYoolaSmsConfigured, normalizeYoolaPhone, sendYoolaSms } from "./yoola-sms";

const SCHOOL_TIME_ZONE = "Africa/Kampala";
const FEE_REMINDER_HOUR = 9;
const FEE_REMINDER_BATCH_SIZE = 100;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type SmsChannel = "payment_confirmation" | "announcement" | "event" | "fee_reminder";
type SmsPayment = {
  id: string;
  studentId: string;
  receiptNumber: string;
  studentName: string;
  amount: number;
  balance: number;
  status?: string;
};

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

async function reserveSmsDelivery(
  deliveryKey: string,
  channel: SmsChannel,
  recipientCount: number,
): Promise<{ id: string; schoolId: string } | undefined> {
  const schoolId = await getSchoolId();
  const id = deterministicUuid(`${schoolId}:${deliveryKey}`);
  const inserted = (await db.insert(notifications).values({
    id,
    schoolId,
    data: {
      smsDelivery: true,
      provider: "yoola",
      channel,
      status: "sending",
      deliveryKeyHash: hash(deliveryKey),
      recipientCount,
    },
  }).onConflictDoNothing({ target: notifications.id }).returning({ id: notifications.id }))[0];
  return inserted ? { id, schoolId } : undefined;
}

async function finishSmsDelivery(
  reservation: { id: string; schoolId: string },
  result: { status: "sent" | "failed"; messageId?: string; reason?: string },
): Promise<void> {
  const row = (await db.select({ data: notifications.data }).from(notifications).where(and(
    eq(notifications.id, reservation.id),
    eq(notifications.schoolId, reservation.schoolId),
  )).limit(1))[0];
  if (!row) return;
  await db.update(notifications).set({
    data: {
      ...row.data,
      status: result.status,
      ...(result.status === "sent" ? { sentAt: new Date().toISOString() } : {}),
      ...(result.messageId ? { providerMessageId: result.messageId } : {}),
      ...(result.reason ? { failureCode: result.reason } : {}),
    },
    updatedAt: new Date(),
  }).where(and(eq(notifications.id, reservation.id), eq(notifications.schoolId, reservation.schoolId)));
}

async function dispatchSms(
  channel: SmsChannel,
  deliveryKey: string,
  rawPhones: string[],
  rawMessage: string,
): Promise<void> {
  if (!isYoolaSmsConfigured()) return;

  const message = compactSingleSegmentSms(rawMessage);
  const phones = [...new Set(rawPhones.map(normalizeYoolaPhone).filter((phone): phone is string => Boolean(phone)))].sort();
  if (!message || !phones.length) return;

  for (let offset = 0; offset < phones.length; offset += FEE_REMINDER_BATCH_SIZE) {
    const batch = phones.slice(offset, offset + FEE_REMINDER_BATCH_SIZE);
    const batchKey = `${channel}:${deliveryKey}:${hash(batch.join(","))}`;
    let reservation: { id: string; schoolId: string } | undefined;
    try {
      reservation = await reserveSmsDelivery(batchKey, channel, batch.length);
    } catch {
      logger.error({ channel, recipientCount: batch.length }, "Could not reserve Yoola SMS delivery; message not sent");
      continue;
    }
    if (!reservation) continue;

    const result = await sendYoolaSms(batch, message);
    if (result.status === "sent") {
      try {
        await finishSmsDelivery(reservation, result);
      } catch {
        logger.error({ channel, recipientCount: batch.length }, "Yoola accepted an SMS batch but its delivery record could not be updated");
      }
      continue;
    }

    const failureCode = result.status === "failed" ? result.reason : result.status;
    try {
      await finishSmsDelivery(reservation, { status: "failed", reason: failureCode });
    } catch {
      logger.error({ channel, recipientCount: batch.length }, "Yoola SMS failure status could not be saved");
    }
    logger.warn({ channel, recipientCount: batch.length, reason: failureCode }, "Yoola SMS batch failed; automatic retry suppressed");
  }
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

function kampalaDateParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute") };
}

function feeReminderWeekKey(date: Date): string {
  const { year, month, day } = kampalaDateParts(date);
  const localDate = Date.UTC(year, month - 1, day);
  const weekday = new Date(localDate).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return new Date(localDate - daysSinceMonday * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function sendWeeklyFeeBalanceReminders(now = new Date()): Promise<void> {
  if (!isYoolaSmsConfigured()) return;
  try {
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

    const weekKey = feeReminderWeekKey(now);
    const entries = [...groups.entries()];
    const concurrency = 4;
    for (let offset = 0; offset < entries.length; offset += concurrency) {
      await Promise.all(entries.slice(offset, offset + concurrency).map(async ([phone, summary]) => {
        const pupilLabel = summary.pupilCount === 1 ? "pupil" : "pupils";
        const message = `EMMECTY: ${settings.currencyCode} ${formatAmount(summary.total)} remains due for ${summary.pupilCount} ${pupilLabel}. Please contact the school office if paid.`;
        await dispatchSms(
          "fee_reminder",
          `fee-reminder:${weekKey}:${hash(phone)}`,
          [phone],
          message,
        );
      }));
    }
  } catch {
    logger.error({ weekKey: feeReminderWeekKey(now) }, "Weekly Yoola fee reminders could not be processed");
  }
}

function millisecondsUntilNextMondayAtNine(now: Date): number {
  const { year, month, day, hour, minute } = kampalaDateParts(now);
  const localMidnightUtc = Date.UTC(year, month - 1, day);
  const weekday = new Date(localMidnightUtc).getUTCDay();
  let daysUntilMonday = (1 - weekday + 7) % 7;
  if (daysUntilMonday === 0 && (hour > FEE_REMINDER_HOUR || (hour === FEE_REMINDER_HOUR && minute > 0))) {
    daysUntilMonday = 7;
  }
  const targetUtc = localMidnightUtc + daysUntilMonday * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000;
  return Math.max(1_000, targetUtc - now.getTime());
}

export function startWeeklyFeeReminderScheduler(): void {
  if (!isYoolaSmsConfigured()) {
    logger.info("Yoola SMS is not configured; outbound SMS remains disabled");
  }

  const scheduleNext = () => {
    const timer = setTimeout(async () => {
      try {
        await sendWeeklyFeeBalanceReminders();
      } finally {
        scheduleNext();
      }
    }, millisecondsUntilNextMondayAtNine(new Date()));
    timer.unref?.();
  };

  scheduleNext();
  logger.info(
    { timeZone: SCHOOL_TIME_ZONE, weekday: "Monday", hour: FEE_REMINDER_HOUR },
    "Weekly Yoola fee reminders scheduled",
  );
}