import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { academicWorkspaceSchemaState } from "./academic-schema";
import {
  academicAdjustments, academicDepartures, academicEnrollments, academicFeeCharges,
  academicFeeSchedules, academicPaymentAllocations, academicTerms, academicYears, payments, promotionCycles,
  promotionDecisions, recordSequences, schoolSettings, students,
} from "@workspace/db";

const today = () => new Date().toISOString().slice(0, 10);
const amountNumber = (value: string | number | null | undefined) => Number(value ?? 0);
const positiveMoney = (value: number) => Number.isFinite(value) && value > 0 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
const normalizeScheduleValue = (value: string | null | undefined) => (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const feeScheduleResponse = (row: typeof academicFeeSchedules.$inferSelect) => ({
  ...row, amount: amountNumber(row.amount), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});

export async function academicSchoolId() {
  const school = (await db.select({ id: schoolSettings.id }).from(schoolSettings).limit(1))[0];
  if (!school) throw new Error("School settings are not initialized");
  return school.id;
}

export async function listAcademicYears() {
  const schoolId = await academicSchoolId();
  const years = await db.select().from(academicYears).where(eq(academicYears.schoolId, schoolId)).orderBy(desc(academicYears.year));
  const terms = years.length
    ? await db.select().from(academicTerms).where(and(eq(academicTerms.schoolId, schoolId), inArray(academicTerms.academicYearId, years.map((year) => year.id))))
    : [];
  return years.map((year) => ({ ...year, terms: terms.filter((term) => term.academicYearId === year.id).sort((a, b) => a.number - b.number) }));
}

export async function createAcademicYear(year: number, actorId: string) {
  const schoolId = await academicSchoolId();
  return db.transaction(async (tx) => {
    const row = (await tx.insert(academicYears).values({ schoolId, year, createdBy: actorId }).onConflictDoNothing().returning())[0]
      ?? (await tx.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.year, year))).limit(1))[0];
    if (!row) throw new Error("Unable to create academic year");
    for (const number of [1, 2, 3]) {
      await tx.insert(academicTerms).values({ schoolId, academicYearId: row.id, number }).onConflictDoNothing();
    }
    return row;
  });
}

export async function openAcademicTerm(termId: string, dates: { startsOn: string; endsOn: string }, actorId: string) {
  const schoolId = await academicSchoolId();
  return db.transaction(async (tx) => {
    const term = (await tx.select().from(academicTerms)
      .where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.id, termId))).for("update").limit(1))[0];
    if (!term) return undefined;
    if (dates.startsOn > dates.endsOn) throw new Error("Term start date must be on or before its end date");
    if (term.status === "closed") throw new Error("A closed term cannot be reopened");
    const otherOpenTerms = await tx.select({ id: academicTerms.id }).from(academicTerms)
      .where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.status, "open"), ne(academicTerms.id, term.id))).limit(1);
    if (otherOpenTerms.length) throw new Error("Close the current term before opening another term");
    const earlierTerms = await tx.select({ number: academicTerms.number, status: academicTerms.status }).from(academicTerms)
      .where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.academicYearId, term.academicYearId)));
    if (earlierTerms.some((earlier) => earlier.number < term.number && earlier.status !== "closed")) {
      throw new Error("Close all earlier terms in this academic year before opening this one");
    }
    if (term.startsOn && term.startsOn !== dates.startsOn || term.endsOn && term.endsOn !== dates.endsOn) {
      throw new Error("Term dates cannot be changed after they have been set");
    }
    const currentTerm = { ...term, startsOn: term.startsOn ?? dates.startsOn, endsOn: term.endsOn ?? dates.endsOn };
    const active = await tx.select({ enrollment: academicEnrollments, student: students })
      .from(academicEnrollments).innerJoin(students, and(eq(academicEnrollments.studentId, students.id), eq(academicEnrollments.schoolId, students.schoolId)))
      .where(and(
        eq(academicEnrollments.schoolId, schoolId), eq(academicEnrollments.academicYearId, term.academicYearId),
        eq(academicEnrollments.status, "active"), eq(students.status, "active"),
      )).for("update");
    const schedules = await tx.select().from(academicFeeSchedules)
      .where(and(eq(academicFeeSchedules.schoolId, schoolId), eq(academicFeeSchedules.academicYearId, term.academicYearId), eq(academicFeeSchedules.termId, term.id)));
    const schedulesByPupil = new Map<string, typeof schedules>();
    for (const { enrollment, student } of active) {
      const matches = schedules.filter((schedule) =>
        normalizeScheduleValue(schedule.className) === normalizeScheduleValue(enrollment.className)
        && normalizeScheduleValue(schedule.stream) === normalizeScheduleValue(enrollment.stream)
        && normalizeScheduleValue(schedule.enrollmentType) === normalizeScheduleValue(student.enrollmentType));
      if (!matches.length) {
        throw new Error(`Missing fee schedule for ${enrollment.className}${enrollment.stream ? ` / ${enrollment.stream}` : ""} / ${student.enrollmentType || "unspecified enrollment type"}; no term charges were created.`);
      }
      schedulesByPupil.set(enrollment.id, matches);
    }
    let createdCharges = 0;
    for (const { enrollment, student } of active) {
      for (const schedule of schedulesByPupil.get(enrollment.id) ?? []) {
        const category = normalizeScheduleValue(schedule.category);
        const chargeAmount = student.isSponsored ? 0 : amountNumber(schedule.amount);
        const existing = (await tx.select().from(academicFeeCharges).where(and(
          eq(academicFeeCharges.schoolId, schoolId), eq(academicFeeCharges.enrollmentId, enrollment.id),
          eq(academicFeeCharges.termId, term.id),
          sql`lower(regexp_replace(btrim(${academicFeeCharges.category}), '[[:space:]]+', ' ', 'g')) = ${category}`,
        )).limit(1))[0];
        if (existing) {
          if (amountNumber(existing.amount) !== chargeAmount) {
            throw new Error(`Existing ${schedule.category} charge for ${enrollment.className} conflicts with its fee schedule; no term charges were added.`);
          }
          continue;
        }
        const idempotencyKey = `term-schedule:${schedule.id}:enrollment:${enrollment.id}`;
        const [charge] = await tx.insert(academicFeeCharges).values({
          schoolId, enrollmentId: enrollment.id, studentId: student.id, academicYearId: term.academicYearId,
          termId: term.id, category, amount: String(chargeAmount), description: schedule.description,
          idempotencyKey, createdBy: actorId,
        }).onConflictDoNothing().returning({ id: academicFeeCharges.id });
        if (charge) {
          createdCharges++;
          continue;
        }
        const racedCharge = (await tx.select().from(academicFeeCharges).where(and(
          eq(academicFeeCharges.schoolId, schoolId), eq(academicFeeCharges.enrollmentId, enrollment.id),
          eq(academicFeeCharges.termId, term.id),
          sql`lower(regexp_replace(btrim(${academicFeeCharges.category}), '[[:space:]]+', ' ', 'g')) = ${category}`,
        )).limit(1))[0];
        if (!racedCharge || amountNumber(racedCharge.amount) !== chargeAmount) {
          throw new Error(`Concurrent fee-charge conflict for ${enrollment.className}; no term charges were committed.`);
        }
      }
    }
    await tx.update(academicYears).set({ status: "closed", updatedAt: new Date() })
      .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.status, "current"), ne(academicYears.id, term.academicYearId)));
    await tx.update(academicTerms).set({ status: "open", startsOn: currentTerm.startsOn, endsOn: currentTerm.endsOn, updatedAt: new Date() })
      .where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.id, termId)));
    await tx.update(academicYears).set({ status: "current", updatedAt: new Date() })
      .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, term.academicYearId)));
    return { ...currentTerm, status: "open", createdCharges };
  });
}

export async function closeAcademicTerm(termId: string) {
  const schoolId = await academicSchoolId();
  return db.transaction(async (tx) => {
    const [term] = await tx.update(academicTerms).set({ status: "closed", updatedAt: new Date() })
      .where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.id, termId))).returning();
    if (!term) return undefined;
    const remaining = await tx.select({ count: sql<number>`count(*)` }).from(academicTerms)
      .where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.academicYearId, term.academicYearId), ne(academicTerms.status, "closed")));
    if (Number(remaining[0]?.count ?? 0) === 0) {
      await tx.update(academicYears).set({ status: "closed", updatedAt: new Date() }).where(eq(academicYears.id, term.academicYearId));
    }
    return term;
  });
}

export async function listTermFeeSchedules(termId: string) {
  const schoolId = await academicSchoolId();
  const term = (await db.select({ id: academicTerms.id }).from(academicTerms)
    .where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.id, termId))).limit(1))[0];
  if (!term) return undefined;
  const rows = await db.select().from(academicFeeSchedules)
    .where(and(eq(academicFeeSchedules.schoolId, schoolId), eq(academicFeeSchedules.termId, term.id)))
    .orderBy(academicFeeSchedules.className, academicFeeSchedules.stream, academicFeeSchedules.enrollmentType, academicFeeSchedules.category);
  return rows.map(feeScheduleResponse);
}

export async function upsertTermFeeSchedule(data: {
  termId: string; className: string; stream?: string; enrollmentType?: string;
  category: string; amount: number; description?: string; actorId: string;
}) {
  if (!Number.isFinite(data.amount) || data.amount < 0 || Math.abs(data.amount * 100 - Math.round(data.amount * 100)) > 1e-7) {
    throw new Error("Scheduled amount must be non-negative with at most two decimals");
  }
  const schoolId = await academicSchoolId();
  const className = data.className.normalize("NFKC").trim().replace(/\s+/g, " ");
  const stream = (data.stream ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  const enrollmentType = (data.enrollmentType ?? "").trim().toLowerCase();
  const category = data.category.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  if (!className || !category) throw new Error("Class and fee category are required");
  if (!["", "day", "boarding"].includes(enrollmentType)) throw new Error("Enrollment type must be day, boarding, or unspecified");
  return db.transaction(async (tx) => {
    const term = (await tx.select().from(academicTerms)
      .where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.id, data.termId))).for("update").limit(1))[0];
    if (!term) return undefined;
    if (term.status === "closed") throw new Error("Fee schedules cannot be changed for a closed term");
    if (term.status === "open") {
      const existingCharges = (await tx.select({ id: academicFeeCharges.id }).from(academicFeeCharges)
        .where(and(eq(academicFeeCharges.schoolId, schoolId), eq(academicFeeCharges.termId, term.id))).limit(1))[0];
      if (existingCharges) throw new Error("An opened term's fee schedule is immutable after charges exist; use an audited adjustment");
    }
    const existing = (await tx.select().from(academicFeeSchedules).where(and(
      eq(academicFeeSchedules.schoolId, schoolId), eq(academicFeeSchedules.termId, term.id),
      sql`lower(regexp_replace(btrim(${academicFeeSchedules.className}), '[[:space:]]+', ' ', 'g')) = ${normalizeScheduleValue(className)}`,
      sql`lower(regexp_replace(btrim(${academicFeeSchedules.stream}), '[[:space:]]+', ' ', 'g')) = ${normalizeScheduleValue(stream)}`,
      sql`lower(btrim(${academicFeeSchedules.enrollmentType})) = ${enrollmentType}`,
      sql`lower(regexp_replace(btrim(${academicFeeSchedules.category}), '[[:space:]]+', ' ', 'g')) = ${category}`,
    )).limit(1))[0];
    if (existing) {
      const [updated] = await tx.update(academicFeeSchedules).set({
        className, stream, enrollmentType, category, amount: String(data.amount),
        description: data.description?.trim() ?? "", updatedBy: data.actorId, updatedAt: new Date(),
      }).where(and(eq(academicFeeSchedules.schoolId, schoolId), eq(academicFeeSchedules.id, existing.id))).returning();
      return updated ? feeScheduleResponse(updated) : undefined;
    }
    const [created] = await tx.insert(academicFeeSchedules).values({
      schoolId, academicYearId: term.academicYearId, termId: term.id, className, stream, enrollmentType, category,
      amount: String(data.amount), description: data.description?.trim() ?? "", createdBy: data.actorId, updatedBy: data.actorId,
    }).onConflictDoNothing().returning();
    if (created) return feeScheduleResponse(created);
    throw new Error("A matching fee-schedule line was created concurrently; retry to update it");
  });
}

export async function importCurrentEnrollments(yearId: string) {
  const schoolId = await academicSchoolId();
  const year = (await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, yearId))).limit(1))[0];
  if (!year) return undefined;
  if (year.status === "closed") throw new Error("Cannot add current pupils to a closed academic year");
  const pupils = await db.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.status, "active")));
  let created = 0;
  let eligible = 0;
  for (const pupil of pupils) {
    const outcome = await db.transaction(async (tx) => {
      const current = (await tx.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.id, pupil.id))).for("update").limit(1))[0];
      if (!current || current.status !== "active") return "skipped";
      const row = (await tx.insert(academicEnrollments).values({
        schoolId, studentId: current.id, academicYearId: yearId, className: current.className,
        stream: current.stream, status: "active", enrolledOn: today(),
      }).onConflictDoNothing().returning({ id: academicEnrollments.id }))[0];
      return row ? "created" : "unchanged";
    });
    if (outcome !== "skipped") eligible++;
    if (outcome === "created") created++;
  }
  return { yearId, activePupils: eligible, created, unchanged: eligible - created };
}

export async function listAcademicEnrollments(yearId: string, includeFormer = true) {
  const schoolId = await academicSchoolId();
  const rows = await db.select({
    enrollment: academicEnrollments, student: students,
  }).from(academicEnrollments).innerJoin(students, and(eq(academicEnrollments.studentId, students.id), eq(academicEnrollments.schoolId, students.schoolId)))
    .where(and(eq(academicEnrollments.schoolId, schoolId), eq(academicEnrollments.academicYearId, yearId)))
    .orderBy(students.lastName, students.firstName);
  return rows.filter(({ enrollment }) => includeFormer || enrollment.status === "active").map(({ enrollment, student }) => ({
    ...enrollment, studentName: `${student.firstName}${student.middleName ? ` ${student.middleName}` : ""} ${student.lastName}`,
    registrationNumber: student.registrationNumber,
  }));
}

export async function createEnrollment(data: { yearId: string; studentId: string; className: string; stream?: string; enrolledOn?: string }) {
  const schoolId = await academicSchoolId();
  return db.transaction(async (tx) => {
    const student = (await tx.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.id, data.studentId))).for("update").limit(1))[0];
    const year = (await tx.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, data.yearId))).limit(1))[0];
    if (!year || !student) return undefined;
    if (year.status === "closed") throw new Error("Cannot create an enrollment in a closed academic year");
    const [enrollment] = await tx.insert(academicEnrollments).values({
      schoolId, studentId: student.id, academicYearId: year.id, className: data.className.trim(),
      stream: data.stream?.trim() ?? "", status: "active", enrolledOn: data.enrolledOn ?? today(),
    }).onConflictDoNothing().returning();
    if (!enrollment) throw new Error("This pupil already has an enrollment for that academic year");
    await tx.update(students).set({ status: "active", className: enrollment.className, stream: enrollment.stream, updatedAt: new Date() })
      .where(and(eq(students.schoolId, schoolId), eq(students.id, student.id)));
    return enrollment;
  });
}

export async function createFeeCharge(data: {
  enrollmentId: string; termId: string; category: string; amount: number; description?: string; idempotencyKey: string; actorId: string;
}) {
  if (!Number.isFinite(data.amount) || data.amount < 0 || Math.abs(data.amount * 100 - Math.round(data.amount * 100)) > 1e-7) throw new Error("Charge amount must be non-negative with at most two decimals");
  const schoolId = await academicSchoolId();
  const category = data.category.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  const key = data.idempotencyKey.trim();
  if (!category || !key) throw new Error("Fee category and idempotency key are required");
  return db.transaction(async (tx) => {
    const enrollment = (await tx.select().from(academicEnrollments)
      .where(and(eq(academicEnrollments.schoolId, schoolId), eq(academicEnrollments.id, data.enrollmentId))).for("update").limit(1))[0];
    if (!enrollment) throw new Error("Pupil enrollment not found in this school");
    const student = (await tx.select({ id: students.id, status: students.status, isSponsored: students.isSponsored }).from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.id, enrollment.studentId))).for("update").limit(1))[0];
    const term = (await tx.select().from(academicTerms)
      .where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.id, data.termId))).limit(1))[0];
    const year = term
      ? (await tx.select({ id: academicYears.id }).from(academicYears)
        .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, term.academicYearId))).limit(1))[0]
      : undefined;
    if (!student || !term || !year || enrollment.academicYearId !== term.academicYearId) {
      throw new Error("The term, academic year, and pupil enrollment must belong to the same school and year");
    }
    if (term.status === "closed") throw new Error("Cannot add new fee charges to a closed term; use a documented adjustment instead");
    if (enrollment.status !== "active") throw new Error("Fees cannot be charged to an inactive or former enrollment");
    if (student.status !== "active") throw new Error("Fees cannot be charged to an inactive pupil profile");
    if (student.isSponsored && data.amount !== 0) throw new Error("Sponsored pupils must have zero-payable charges");
    const existing = (await tx.select().from(academicFeeCharges).where(and(
      eq(academicFeeCharges.schoolId, schoolId), eq(academicFeeCharges.enrollmentId, enrollment.id),
      eq(academicFeeCharges.termId, term.id),
      sql`lower(regexp_replace(btrim(${academicFeeCharges.category}), '[[:space:]]+', ' ', 'g')) = ${category}`,
    )).limit(1))[0];
    if (existing) {
      if (amountNumber(existing.amount) !== data.amount) throw new Error("A charge already exists for this enrollment, term, and category; use an audited adjustment instead");
      return existing;
    }
    const [charge] = await tx.insert(academicFeeCharges).values({
      schoolId, enrollmentId: enrollment.id, studentId: enrollment.studentId, academicYearId: enrollment.academicYearId,
      termId: term.id, category, amount: String(data.amount),
      description: data.description ?? "", idempotencyKey: key, createdBy: data.actorId,
    }).onConflictDoNothing().returning();
    if (charge) return charge;
    const byKey = (await tx.select().from(academicFeeCharges).where(and(eq(academicFeeCharges.schoolId, schoolId), eq(academicFeeCharges.idempotencyKey, key))).limit(1))[0];
    const normalizedExistingCategory = byKey?.category.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
    if (byKey && byKey.enrollmentId === enrollment.id && byKey.termId === term.id && normalizedExistingCategory === category && amountNumber(byKey.amount) === data.amount) return byKey;
    if (byKey) throw new Error("This idempotency key has already been used for a different fee charge");
    throw new Error("This charge conflicts with an existing fee category");
  });
}

export async function getTermFeeStatement(termId: string) {
  const schoolId = await academicSchoolId();
  const term = (await db.select().from(academicTerms).where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.id, termId))).limit(1))[0];
  if (!term) return undefined;
  const year = (await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, term.academicYearId))).limit(1))[0];
  const charges = await db.select({
    charge: academicFeeCharges, enrollment: academicEnrollments, student: students,
  }).from(academicFeeCharges).innerJoin(academicEnrollments, and(eq(academicFeeCharges.enrollmentId, academicEnrollments.id), eq(academicFeeCharges.schoolId, academicEnrollments.schoolId)))
    .innerJoin(students, and(eq(academicEnrollments.studentId, students.id), eq(academicEnrollments.schoolId, students.schoolId)))
    .where(and(eq(academicFeeCharges.schoolId, schoolId), eq(academicFeeCharges.termId, termId)));
  const studentIds = [...new Set(charges.map(({ student }) => student.id))];
  const enrollments = studentIds.length ? await db.select().from(academicEnrollments).where(and(eq(academicEnrollments.schoolId, schoolId), inArray(academicEnrollments.studentId, studentIds))) : [];
  const enrollmentIds = enrollments.map((row) => row.id);
  const allCharges = enrollmentIds.length ? await db.select().from(academicFeeCharges).where(and(eq(academicFeeCharges.schoolId, schoolId), inArray(academicFeeCharges.enrollmentId, enrollmentIds))) : [];
  const ids = allCharges.map((row) => row.id);
  const allocations = ids.length ? await db.select().from(academicPaymentAllocations).where(and(eq(academicPaymentAllocations.schoolId, schoolId), inArray(academicPaymentAllocations.chargeId, ids))) : [];
  const paymentDetails = ids.length ? await db.select({ allocation: academicPaymentAllocations, payment: payments })
    .from(academicPaymentAllocations).innerJoin(payments, and(eq(academicPaymentAllocations.paymentId, payments.id), eq(academicPaymentAllocations.schoolId, payments.schoolId)))
    .where(and(eq(academicPaymentAllocations.schoolId, schoolId), inArray(academicPaymentAllocations.chargeId, ids))) : [];
  const adjustments = ids.length ? await db.select().from(academicAdjustments).where(and(eq(academicAdjustments.schoolId, schoolId), inArray(academicAdjustments.chargeId, ids))) : [];
  const termIds = [...new Set(allCharges.map((row) => row.termId))];
  const allTerms = termIds.length ? await db.select().from(academicTerms).where(and(eq(academicTerms.schoolId, schoolId), inArray(academicTerms.id, termIds))) : [];
  const allYearIds = [...new Set(allTerms.map((row) => row.academicYearId))];
  const allYears = allYearIds.length ? await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), inArray(academicYears.id, allYearIds))) : [];
  const termOrder = (termNumber: number, yearNumber: number) => yearNumber * 10 + termNumber;
  const currentOrder = termOrder(term.number, year?.year ?? 0);
  const rows = charges.map(({ charge, enrollment, student }, rowIndex) => {
    const paid = allocations.filter((row) => row.chargeId === charge.id).reduce((sum, row) => sum + amountNumber(row.amount), 0);
    const waived = adjustments.filter((row) => row.chargeId === charge.id && ["waiver", "write_off", "credit", "correction"].includes(row.kind)).reduce((sum, row) => sum + amountNumber(row.amount), 0);
    const refunded = adjustments.filter((row) => row.chargeId === charge.id && row.kind === "refund").reduce((sum, row) => sum + amountNumber(row.amount), 0);
    const charged = amountNumber(charge.amount);
    const previousOutstanding = allCharges.reduce((sum, priorCharge) => {
      const priorEnrollment = enrollments.find((row) => row.id === priorCharge.enrollmentId);
      if (!priorEnrollment || priorEnrollment.studentId !== student.id) return sum;
      const priorTerm = allTerms.find((row) => row.id === priorCharge.termId);
      const priorYear = priorTerm ? allYears.find((row) => row.id === priorTerm.academicYearId) : undefined;
      if (!priorTerm || !priorYear || termOrder(priorTerm.number, priorYear.year) >= currentOrder) return sum;
      const priorPaid = allocations.filter((row) => row.chargeId === priorCharge.id).reduce((value, row) => value + amountNumber(row.amount), 0);
      const priorAdjusted = adjustments.filter((row) => row.chargeId === priorCharge.id && ["waiver", "write_off", "credit", "correction"].includes(row.kind)).reduce((value, row) => value + amountNumber(row.amount), 0);
      const priorRefunded = adjustments.filter((row) => row.chargeId === priorCharge.id && row.kind === "refund").reduce((value, row) => value + amountNumber(row.amount), 0);
      return sum + Math.max(0, amountNumber(priorCharge.amount) - priorPaid + priorRefunded - priorAdjusted);
    }, 0);
    return {
      chargeId: charge.id, enrollmentId: enrollment.id, studentId: student.id,
      studentName: `${student.firstName}${student.middleName ? ` ${student.middleName}` : ""} ${student.lastName}`,
      registrationNumber: student.registrationNumber, className: enrollment.className, stream: enrollment.stream,
      category: charge.category, description: charge.description, charged, paid,
      previousOutstanding: rowIndex === charges.findIndex((row) => row.student.id === student.id) ? previousOutstanding : 0,
      totalDue: rowIndex === charges.findIndex((row) => row.student.id === student.id) ? previousOutstanding + charges.filter((row) => row.student.id === student.id).reduce((sum, row) => sum + amountNumber(row.charge.amount), 0) : 0,
      refunded, outstanding: Math.max(0, charged - paid + refunded - waived), credit: Math.max(0, paid - refunded + waived - charged),
      payments: paymentDetails.filter(({ allocation }) => allocation.chargeId === charge.id).map(({ allocation, payment }) => ({
        paymentId: payment.id, receiptNumber: payment.receiptNumber, amount: amountNumber(allocation.amount),
        paidOn: payment.paidOn, method: payment.method, reference: payment.reference, recordedBy: allocation.recordedBy,
      })),
    };
  });
  const pupilSummaries = [...new Map(rows.map((row) => [row.studentId, row])).values()].map((row) => {
    const pupilRows = rows.filter((item) => item.studentId === row.studentId);
    const previousOutstanding = pupilRows.find((item) => item.previousOutstanding > 0)?.previousOutstanding ?? 0;
    return {
      studentId: row.studentId, studentName: row.studentName, registrationNumber: row.registrationNumber,
      className: row.className, stream: row.stream, previousOutstanding,
      currentCharges: pupilRows.reduce((sum, item) => sum + item.charged, 0),
      totalDue: previousOutstanding + pupilRows.reduce((sum, item) => sum + item.charged, 0),
      paidThisTerm: pupilRows.reduce((sum, item) => sum + item.paid, 0),
      outstandingThisTerm: pupilRows.reduce((sum, item) => sum + item.outstanding, 0),
      credit: pupilRows.reduce((sum, item) => sum + item.credit, 0),
    };
  });
  return { term, rows, pupils: pupilSummaries };
}

export async function recordAcademicPayment(data: { chargeId: string; studentId?: string; amount: number; method: string; reference?: string; idempotencyKey: string; actorId: string }) {
  if (!positiveMoney(data.amount)) throw new Error("Payment amount must be positive with at most two decimal places");
  const idempotencyKey = data.idempotencyKey.trim();
  if (!idempotencyKey) throw new Error("A payment idempotency key is required");
  const schoolId = await academicSchoolId();
  return db.transaction(async (tx) => {
    const charge = (await tx.select({ charge: academicFeeCharges, enrollment: academicEnrollments, student: students, term: academicTerms, year: academicYears })
      .from(academicFeeCharges).innerJoin(academicEnrollments, and(eq(academicFeeCharges.enrollmentId, academicEnrollments.id), eq(academicFeeCharges.schoolId, academicEnrollments.schoolId)))
      .innerJoin(students, and(eq(academicEnrollments.studentId, students.id), eq(academicEnrollments.schoolId, students.schoolId)))
      .innerJoin(academicTerms, and(eq(academicFeeCharges.termId, academicTerms.id), eq(academicFeeCharges.schoolId, academicTerms.schoolId)))
      .innerJoin(academicYears, and(eq(academicTerms.academicYearId, academicYears.id), eq(academicTerms.schoolId, academicYears.schoolId)))
      .where(and(eq(academicFeeCharges.schoolId, schoolId), eq(academicFeeCharges.id, data.chargeId))).for("update").limit(1))[0];
    if (!charge) return undefined;
    if (data.studentId && data.studentId !== charge.student.id) throw new Error("The selected charge does not belong to this pupil");
    const priorAllocation = (await tx.select({ allocation: academicPaymentAllocations, payment: payments })
      .from(academicPaymentAllocations).innerJoin(payments, and(eq(academicPaymentAllocations.paymentId, payments.id), eq(academicPaymentAllocations.schoolId, payments.schoolId)))
      .where(and(eq(academicPaymentAllocations.schoolId, schoolId), eq(academicPaymentAllocations.idempotencyKey, idempotencyKey))).limit(1))[0];
    if (priorAllocation) {
      if (priorAllocation.allocation.chargeId !== data.chargeId
        || amountNumber(priorAllocation.allocation.amount) !== data.amount
        || priorAllocation.payment.method !== data.method
        || priorAllocation.payment.reference !== (data.reference ?? "")) {
        throw new Error("This payment idempotency key was already used for different payment details");
      }
      const [paidNow] = await tx.select({ amount: sql<string>`coalesce(sum(${academicPaymentAllocations.amount}), 0)` })
        .from(academicPaymentAllocations).where(and(eq(academicPaymentAllocations.schoolId, schoolId), eq(academicPaymentAllocations.chargeId, data.chargeId)));
      const [adjustedNow] = await tx.select({
        amount: sql<string>`coalesce(sum(${academicAdjustments.amount}) filter (where ${academicAdjustments.kind} in ('waiver', 'write_off', 'credit', 'correction')), 0)`,
        refunded: sql<string>`coalesce(sum(${academicAdjustments.amount}) filter (where ${academicAdjustments.kind} = 'refund'), 0)`,
      }).from(academicAdjustments).where(and(eq(academicAdjustments.schoolId, schoolId), eq(academicAdjustments.chargeId, data.chargeId)));
      const currentBalance = Math.max(0, amountNumber(charge.charge.amount) - amountNumber(paidNow?.amount) + amountNumber(adjustedNow?.refunded) - amountNumber(adjustedNow?.amount));
      return {
        id: priorAllocation.payment.id, studentId: charge.student.id, receiptNumber: priorAllocation.payment.receiptNumber,
        amount: data.amount, method: priorAllocation.payment.method, reference: priorAllocation.payment.reference,
        paidOn: priorAllocation.payment.paidOn,
        date: new Date(`${priorAllocation.payment.paidOn}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        studentName: `${charge.student.firstName}${charge.student.middleName ? ` ${charge.student.middleName}` : ""} ${charge.student.lastName}`,
        registrationNumber: charge.student.registrationNumber, status: "completed" as const, balance: currentBalance,
        chargeId: charge.charge.id, termId: charge.charge.termId, termNumber: charge.term.number,
        academicYearId: charge.enrollment.academicYearId, academicYear: charge.year.year,
        recordedBy: priorAllocation.allocation.recordedBy, remainingBalance: currentBalance,
      };
    }
    const [paidRow] = await tx.select({ amount: sql<string>`coalesce(sum(${academicPaymentAllocations.amount}), 0)` })
      .from(academicPaymentAllocations).where(and(eq(academicPaymentAllocations.schoolId, schoolId), eq(academicPaymentAllocations.chargeId, data.chargeId)));
    const [adjustedRow] = await tx.select({
      amount: sql<string>`coalesce(sum(${academicAdjustments.amount}) filter (where ${academicAdjustments.kind} in ('waiver', 'write_off', 'credit', 'correction')), 0)`,
      refunded: sql<string>`coalesce(sum(${academicAdjustments.amount}) filter (where ${academicAdjustments.kind} = 'refund'), 0)`,
    })
      .from(academicAdjustments).where(and(eq(academicAdjustments.schoolId, schoolId), eq(academicAdjustments.chargeId, data.chargeId)));
    const due = amountNumber(charge.charge.amount) - amountNumber(paidRow?.amount) + amountNumber(adjustedRow?.refunded) - amountNumber(adjustedRow?.amount);
    if (data.amount > due + 0.00001) throw new Error("Payment exceeds the selected term charge balance");
    const year = new Date().getFullYear();
    const receiptCount = await tx.select({ count: sql<number>`count(*)` }).from(payments)
      .where(and(eq(payments.schoolId, schoolId), sql`${payments.receiptNumber} like ${`RCPT-${year}-%`}`));
    const sequence = (await tx.insert(recordSequences).values({ schoolId, year, kind: "receipt", value: Number(receiptCount[0]?.count ?? 0) + 1 }).onConflictDoUpdate({
      target: [recordSequences.schoolId, recordSequences.year, recordSequences.kind],
      set: { value: sql`${recordSequences.value} + 1`, updatedAt: new Date() },
    }).returning({ value: recordSequences.value }))[0];
    if (!sequence) throw new Error("Unable to allocate receipt number");
    const receiptNumber = `RCPT-${year}-${String(sequence.value).padStart(4, "0")}`;
    const payment = (await tx.insert(payments).values({
      schoolId, studentId: charge.student.id, receiptNumber, amount: String(data.amount),
      method: data.method, reference: data.reference ?? "", paidOn: today(), status: "completed",
    }).returning())[0];
    if (!payment) throw new Error("Unable to record payment");
    await tx.insert(academicPaymentAllocations).values({
      schoolId, paymentId: payment.id, chargeId: charge.charge.id, studentId: charge.student.id,
      academicYearId: charge.enrollment.academicYearId, termId: charge.charge.termId, amount: String(data.amount),
      idempotencyKey, recordedBy: data.actorId,
    });
    const remainingBalance = Math.max(0, due - data.amount);
    return {
      id: payment.id, studentId: charge.student.id, receiptNumber, amount: data.amount, method: payment.method,
      reference: payment.reference, paidOn: payment.paidOn, date: new Date(`${payment.paidOn}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      studentName: `${charge.student.firstName}${charge.student.middleName ? ` ${charge.student.middleName}` : ""} ${charge.student.lastName}`,
      registrationNumber: charge.student.registrationNumber, status: "completed" as const, balance: remainingBalance,
      chargeId: charge.charge.id,
      termId: charge.charge.termId, termNumber: charge.term.number, academicYearId: charge.enrollment.academicYearId,
      academicYear: charge.year.year, attributionStatus: "assigned", recordedBy: data.actorId,
      remainingBalance,
    };
  });
}

export async function allocateExistingPayment(data: {
  paymentId: string; chargeId: string; amount: number; idempotencyKey: string; actorId: string;
}) {
  if (!positiveMoney(data.amount)) throw new Error("Allocation amount must be positive with at most two decimal places");
  const idempotencyKey = data.idempotencyKey.trim();
  if (!idempotencyKey) throw new Error("An allocation idempotency key is required");
  const schoolId = await academicSchoolId();
  return db.transaction(async (tx) => {
    const payment = (await tx.select().from(payments)
      .where(and(eq(payments.schoolId, schoolId), eq(payments.id, data.paymentId))).for("update").limit(1))[0];
    if (!payment) return undefined;
    if (payment.status !== "completed") throw new Error("Only completed legacy payments can be allocated to a term charge");
    const charge = (await tx.select({ charge: academicFeeCharges, enrollment: academicEnrollments, student: students, term: academicTerms, year: academicYears })
      .from(academicFeeCharges).innerJoin(academicEnrollments, and(eq(academicFeeCharges.enrollmentId, academicEnrollments.id), eq(academicFeeCharges.schoolId, academicEnrollments.schoolId)))
      .innerJoin(students, and(eq(academicEnrollments.studentId, students.id), eq(academicEnrollments.schoolId, students.schoolId)))
      .innerJoin(academicTerms, and(eq(academicFeeCharges.termId, academicTerms.id), eq(academicFeeCharges.schoolId, academicTerms.schoolId)))
      .innerJoin(academicYears, and(eq(academicTerms.academicYearId, academicYears.id), eq(academicTerms.schoolId, academicYears.schoolId)))
      .where(and(eq(academicFeeCharges.schoolId, schoolId), eq(academicFeeCharges.id, data.chargeId))).for("update").limit(1))[0];
    if (!charge) throw new Error("Term charge not found in this school");
    if (payment.studentId !== charge.student.id) throw new Error("A payment can only be allocated to the same pupil's term charge");
    const prior = (await tx.select({ allocation: academicPaymentAllocations })
      .from(academicPaymentAllocations)
      .where(and(eq(academicPaymentAllocations.schoolId, schoolId), eq(academicPaymentAllocations.idempotencyKey, idempotencyKey))).limit(1))[0];
    if (prior) {
      if (prior.allocation.paymentId !== payment.id || prior.allocation.chargeId !== charge.charge.id || amountNumber(prior.allocation.amount) !== data.amount) {
        throw new Error("This allocation idempotency key was already used for different details");
      }
      return {
        id: payment.id, studentId: payment.studentId, receiptNumber: payment.receiptNumber, amount: data.amount,
        method: payment.method, reference: payment.reference, paidOn: payment.paidOn,
        chargeId: charge.charge.id, termId: charge.term.id, termNumber: charge.term.number,
        academicYearId: charge.year.id, academicYear: charge.year.year, attributionStatus: "assigned",
        allocationId: prior.allocation.id, recordedBy: prior.allocation.recordedBy, idempotent: true,
      };
    }
    const [alreadyAllocated] = await tx.select({ amount: sql<string>`coalesce(sum(${academicPaymentAllocations.amount}), 0)` })
      .from(academicPaymentAllocations).where(and(eq(academicPaymentAllocations.schoolId, schoolId), eq(academicPaymentAllocations.paymentId, payment.id)));
    const unallocated = amountNumber(payment.amount) - amountNumber(alreadyAllocated?.amount);
    if (data.amount > unallocated + 0.00001) throw new Error("Allocation exceeds the unallocated portion of this receipt");
    const [paid] = await tx.select({ amount: sql<string>`coalesce(sum(${academicPaymentAllocations.amount}), 0)` })
      .from(academicPaymentAllocations).where(and(eq(academicPaymentAllocations.schoolId, schoolId), eq(academicPaymentAllocations.chargeId, charge.charge.id)));
    const [adjusted] = await tx.select({
      waived: sql<string>`coalesce(sum(${academicAdjustments.amount}) filter (where ${academicAdjustments.kind} in ('waiver', 'write_off', 'credit', 'correction')), 0)`,
      refunded: sql<string>`coalesce(sum(${academicAdjustments.amount}) filter (where ${academicAdjustments.kind} = 'refund'), 0)`,
    }).from(academicAdjustments).where(and(eq(academicAdjustments.schoolId, schoolId), eq(academicAdjustments.chargeId, charge.charge.id)));
    const due = amountNumber(charge.charge.amount) - amountNumber(paid?.amount) + amountNumber(adjusted?.refunded) - amountNumber(adjusted?.waived);
    if (data.amount > due + 0.00001) throw new Error("Allocation exceeds the original term charge balance");
    const [allocation] = await tx.insert(academicPaymentAllocations).values({
      schoolId, paymentId: payment.id, chargeId: charge.charge.id, studentId: payment.studentId,
      academicYearId: charge.year.id, termId: charge.term.id, amount: String(data.amount),
      idempotencyKey, recordedBy: data.actorId,
    }).onConflictDoNothing().returning();
    if (!allocation) throw new Error("The receipt was allocated concurrently; retry with the same allocation key");
    return {
      id: payment.id, studentId: payment.studentId, receiptNumber: payment.receiptNumber, amount: data.amount,
      method: payment.method, reference: payment.reference, paidOn: payment.paidOn,
      chargeId: charge.charge.id, termId: charge.term.id, termNumber: charge.term.number,
      academicYearId: charge.year.id, academicYear: charge.year.year, attributionStatus: "assigned",
      allocationId: allocation.id, recordedBy: data.actorId, idempotent: false,
    };
  });
}

export async function createAcademicAdjustment(data: { chargeId: string; kind: string; amount: number; reason: string; notes?: string; actorId: string }) {
  if (!positiveMoney(data.amount) || data.reason.trim().length < 3) throw new Error("An adjustment requires a positive amount and an audit reason");
  const schoolId = await academicSchoolId();
  return db.transaction(async (tx) => {
    const charge = (await tx.select().from(academicFeeCharges).where(and(eq(academicFeeCharges.schoolId, schoolId), eq(academicFeeCharges.id, data.chargeId))).for("update").limit(1))[0];
    if (!charge) return undefined;
    const [paidRow] = await tx.select({ amount: sql<string>`coalesce(sum(${academicPaymentAllocations.amount}), 0)` }).from(academicPaymentAllocations)
      .where(and(eq(academicPaymentAllocations.schoolId, schoolId), eq(academicPaymentAllocations.chargeId, charge.id)));
    const [adjustedRow] = await tx.select({
      amount: sql<string>`coalesce(sum(${academicAdjustments.amount}) filter (where ${academicAdjustments.kind} in ('waiver', 'write_off', 'credit', 'correction')), 0)`,
      refunded: sql<string>`coalesce(sum(${academicAdjustments.amount}) filter (where ${academicAdjustments.kind} = 'refund'), 0)`,
    }).from(academicAdjustments).where(and(eq(academicAdjustments.schoolId, schoolId), eq(academicAdjustments.chargeId, charge.id)));
    if (["waiver", "write_off", "credit", "correction"].includes(data.kind) && data.amount > amountNumber(charge.amount) - amountNumber(paidRow?.amount) + amountNumber(adjustedRow?.refunded) - amountNumber(adjustedRow?.amount) + 0.00001) {
      throw new Error("Adjustment exceeds the unpaid charge amount");
    }
    if (data.kind === "refund" && data.amount > amountNumber(paidRow?.amount) - amountNumber(adjustedRow?.refunded) + 0.00001) {
      throw new Error("Refund exceeds the amount received against this charge");
    }
    const [adjustment] = await tx.insert(academicAdjustments).values({
      schoolId, chargeId: charge.id, kind: data.kind, amount: String(data.amount), reason: data.reason.trim(),
      notes: data.notes ?? "", authorizedBy: data.actorId, adjustedOn: today(),
    }).returning();
    return adjustment;
  });
}

export async function withdrawEnrollment(data: {
  enrollmentId: string; kind: "transferred" | "withdrawn"; leavingOn: string; reason: string;
  destinationSchool?: string; remarks?: string; actorId: string;
}) {
  if (data.reason.trim().length < 3) throw new Error("A leaving reason is required");
  const schoolId = await academicSchoolId();
  return db.transaction(async (tx) => {
    const enrollment = (await tx.select().from(academicEnrollments).where(and(eq(academicEnrollments.schoolId, schoolId), eq(academicEnrollments.id, data.enrollmentId))).for("update").limit(1))[0];
    if (!enrollment) return undefined;
    if (enrollment.status !== "active") throw new Error("Only an active enrollment can be withdrawn or transferred");
    await tx.insert(academicDepartures).values({
      schoolId, enrollmentId: enrollment.id, kind: data.kind, leavingOn: data.leavingOn, reason: data.reason.trim(),
      destinationSchool: data.destinationSchool, remarks: data.remarks ?? "", processedBy: data.actorId,
    });
    const [updated] = await tx.update(academicEnrollments).set({ status: data.kind, endedOn: data.leavingOn, updatedAt: new Date() })
      .where(eq(academicEnrollments.id, enrollment.id)).returning();
    await tx.update(students).set({ status: "inactive", updatedAt: new Date() })
      .where(and(eq(students.schoolId, schoolId), eq(students.id, enrollment.studentId)));
    return updated;
  });
}

export async function createPromotionCycle(fromYearId: string, toYear: number, actorId: string) {
  const schoolId = await academicSchoolId();
  const source = (await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, fromYearId))).limit(1))[0];
  if (!source || source.year + 1 !== toYear) throw new Error("Promotion must target the immediately following academic year");
  const termThree = (await db.select().from(academicTerms).where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.academicYearId, source.id), eq(academicTerms.number, 3))).limit(1))[0];
  if (!termThree || termThree.status !== "closed") throw new Error("Close Term 3 before starting year-end promotion review");
  const target = await createAcademicYear(toYear, actorId).catch(async () => {
    const [row] = await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.year, toYear))).limit(1);
    return row;
  });
  if (!target) throw new Error("Unable to create target academic year");
  const [cycle] = await db.insert(promotionCycles).values({ schoolId, fromYearId, toYearId: target.id }).onConflictDoNothing().returning();
  const actualCycle = cycle ?? (await db.select().from(promotionCycles).where(and(eq(promotionCycles.schoolId, schoolId), eq(promotionCycles.fromYearId, fromYearId), eq(promotionCycles.toYearId, target.id))).limit(1))[0];
  if (!actualCycle) throw new Error("Unable to create promotion review");
  const current = await db.select().from(academicEnrollments).where(and(eq(academicEnrollments.schoolId, schoolId), eq(academicEnrollments.academicYearId, fromYearId), eq(academicEnrollments.status, "active")));
  for (const enrollment of current) {
    await db.insert(promotionDecisions).values({ schoolId, cycleId: actualCycle.id, enrollmentId: enrollment.id, decision: "hold", reviewedBy: actorId })
      .onConflictDoNothing();
  }
  return { ...actualCycle, decisions: await listPromotionDecisions(actualCycle.id) };
}

export async function listPromotionDecisions(cycleId: string) {
  const schoolId = await academicSchoolId();
  return db.select({ decision: promotionDecisions, enrollment: academicEnrollments, student: students })
    .from(promotionDecisions).innerJoin(academicEnrollments, and(eq(promotionDecisions.enrollmentId, academicEnrollments.id), eq(promotionDecisions.schoolId, academicEnrollments.schoolId)))
    .innerJoin(students, and(eq(academicEnrollments.studentId, students.id), eq(academicEnrollments.schoolId, students.schoolId)))
    .where(and(eq(promotionDecisions.schoolId, schoolId), eq(promotionDecisions.cycleId, cycleId)))
    .orderBy(students.lastName, students.firstName);
}

export async function updatePromotionDecision(data: {
  cycleId: string; enrollmentId: string; decision: "promote" | "repeat" | "transfer" | "withdraw" | "graduate" | "hold";
  nextClassName?: string; nextStream?: string; recommendation?: string; approvalNotes?: string; actorId: string;
}) {
  const schoolId = await academicSchoolId();
  const cycle = (await db.select().from(promotionCycles).where(and(eq(promotionCycles.schoolId, schoolId), eq(promotionCycles.id, data.cycleId))).limit(1))[0];
  if (!cycle || cycle.status !== "review") throw new Error("Promotion decisions can only be changed during review");
  const [result] = await db.update(promotionDecisions).set({
    decision: data.decision, nextClassName: data.nextClassName, nextStream: data.nextStream,
    recommendation: data.recommendation ?? "", approvalNotes: data.approvalNotes ?? "",
    reviewedBy: data.actorId, updatedAt: new Date(),
  }).where(and(eq(promotionDecisions.cycleId, data.cycleId), eq(promotionDecisions.enrollmentId, data.enrollmentId))).returning();
  return result;
}

export async function confirmPromotionCycle(cycleId: string, actorId: string) {
  const schoolId = await academicSchoolId();
  return db.transaction(async (tx) => {
    const cycle = (await tx.select().from(promotionCycles).where(and(eq(promotionCycles.schoolId, schoolId), eq(promotionCycles.id, cycleId))).for("update").limit(1))[0];
    if (!cycle) return undefined;
    if (cycle.status === "confirmed") return { cycle, createdEnrollments: 0, idempotent: true };
    const decisions = await tx.select({ decision: promotionDecisions, enrollment: academicEnrollments })
      .from(promotionDecisions).innerJoin(academicEnrollments, and(eq(promotionDecisions.enrollmentId, academicEnrollments.id), eq(promotionDecisions.schoolId, academicEnrollments.schoolId)))
      .where(and(eq(promotionDecisions.schoolId, schoolId), eq(promotionDecisions.cycleId, cycleId)));
    if (!decisions.length || decisions.some(({ decision }) => decision.decision === "hold")) throw new Error("Every active pupil requires a reviewed promotion decision before confirmation");
    let createdEnrollments = 0;
    const target = (await tx.select().from(academicYears).where(eq(academicYears.id, cycle.toYearId)).limit(1))[0];
    if (!target) throw new Error("Target academic year is missing");
    const studentIds = decisions.filter(({ decision }) => ["promote", "repeat"].includes(decision.decision)).map(({ enrollment }) => enrollment.studentId);
    if (studentIds.length) {
      const existingTargetEnrollments = await tx.select({ id: academicEnrollments.id }).from(academicEnrollments)
        .where(and(eq(academicEnrollments.schoolId, schoolId), eq(academicEnrollments.academicYearId, target.id), inArray(academicEnrollments.studentId, studentIds)));
      if (existingTargetEnrollments.length) throw new Error("Some selected pupils already have a new-year enrollment; review before confirmation");
    }
    for (const { decision, enrollment } of decisions) {
      const decisionStatus = decision.decision === "transfer" ? "transferred" : decision.decision === "withdraw" ? "withdrawn" : decision.decision === "graduate" ? "graduated" : "completed";
      await tx.update(academicEnrollments).set({ status: decisionStatus, decision: decision.decision, updatedAt: new Date() }).where(eq(academicEnrollments.id, enrollment.id));
      if (decision.decision === "transfer" || decision.decision === "withdraw") {
        await tx.insert(academicDepartures).values({
          schoolId, enrollmentId: enrollment.id, kind: decision.decision === "transfer" ? "transferred" : "withdrawn",
          leavingOn: today(), reason: decision.approvalNotes.trim() || decision.recommendation.trim() || "Approved through end-of-year review",
          remarks: decision.approvalNotes, processedBy: actorId,
        }).onConflictDoNothing();
      }
      if (["promote", "repeat"].includes(decision.decision)) {
        const [newEnrollment] = await tx.insert(academicEnrollments).values({
          schoolId, studentId: enrollment.studentId, academicYearId: cycle.toYearId,
          className: decision.decision === "repeat" ? enrollment.className : (decision.nextClassName || enrollment.className),
          stream: decision.nextStream ?? enrollment.stream, status: "active", decision: decision.decision,
          repeating: decision.decision === "repeat", enrolledOn: today(),
        }).onConflictDoNothing().returning();
        if (newEnrollment) createdEnrollments++;
        const nextClass = decision.decision === "repeat" ? enrollment.className : (decision.nextClassName || enrollment.className);
        await tx.update(students).set({ status: "active", className: nextClass, stream: decision.nextStream ?? enrollment.stream, updatedAt: new Date() })
          .where(and(eq(students.schoolId, schoolId), eq(students.id, enrollment.studentId)));
      } else {
        await tx.update(students).set({ status: "inactive", updatedAt: new Date() })
          .where(and(eq(students.schoolId, schoolId), eq(students.id, enrollment.studentId)));
      }
    }
    await tx.update(academicYears).set({ status: "closed", updatedAt: new Date() }).where(eq(academicYears.id, cycle.fromYearId));
    await tx.update(academicYears).set({ status: "closed", updatedAt: new Date() })
      .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.status, "current"), ne(academicYears.id, cycle.toYearId)));
    await tx.update(academicYears).set({ status: "current", updatedAt: new Date() }).where(eq(academicYears.id, cycle.toYearId));
    const [confirmed] = await tx.update(promotionCycles).set({ status: "confirmed", confirmedBy: actorId, confirmedAt: new Date() }).where(eq(promotionCycles.id, cycle.id)).returning();
    return { cycle: confirmed, createdEnrollments, idempotent: false };
  });
}

export async function getAcademicDashboard(yearId?: string) {
  const schoolId = await academicSchoolId();
  const year = yearId
    ? (await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, yearId))).limit(1))[0]
    : (await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.status, "current"))).limit(1))[0];
  if (!year) return { year: null, terms: [], promoted: 0, repeating: 0, awaitingDecisions: 0, formerPupils: 0, formerOutstanding: 0, formerPayments: 0 };
  const terms = await db.select().from(academicTerms).where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.academicYearId, year.id)));
  const summaries = [];
  const activeEnrollments = await db.select().from(academicEnrollments)
    .where(and(eq(academicEnrollments.schoolId, schoolId), eq(academicEnrollments.academicYearId, year.id), eq(academicEnrollments.status, "active")));
  for (const term of terms.sort((a, b) => a.number - b.number)) {
    const statement = await getTermFeeStatement(term.id);
    const rows = statement?.rows ?? [];
    const charged = rows.reduce((sum, item) => sum + item.charged, 0);
    const paid = rows.reduce((sum, item) => sum + item.paid, 0);
    const outstanding = rows.reduce((sum, item) => sum + item.outstanding, 0);
    const previousOutstanding = rows.reduce((sum, item) => sum + item.previousOutstanding, 0);
    summaries.push({
      termId: term.id, termNumber: term.number, status: term.status, pupils: activeEnrollments.length,
      charged, collected: paid, outstanding, previousOutstanding, totalDue: charged + previousOutstanding,
      credits: rows.reduce((sum, item) => sum + item.credit, 0),
      fullyPaid: rows.filter((item) => item.charged > 0 && item.outstanding === 0).length,
      partiallyPaid: rows.filter((item) => item.paid > 0 && item.outstanding > 0).length,
      unpaid: rows.filter((item) => item.paid === 0 && item.charged > 0).length,
    });
  }
  const enrollments = await db.select().from(academicEnrollments).where(and(eq(academicEnrollments.schoolId, schoolId), eq(academicEnrollments.academicYearId, year.id)));
  const cycle = (await db.select().from(promotionCycles).where(and(eq(promotionCycles.schoolId, schoolId), eq(promotionCycles.fromYearId, year.id))).limit(1))[0];
  const decisions = cycle ? await db.select().from(promotionDecisions).where(eq(promotionDecisions.cycleId, cycle.id)) : [];
  const formerRows = enrollments.filter((row) => ["transferred", "withdrawn"].includes(row.status));
  const formerIds = formerRows.map((row) => row.id);
  let formerOutstanding = 0;
  let formerPayments = 0;
  if (formerIds.length) {
    const charges = await db.select().from(academicFeeCharges).where(and(eq(academicFeeCharges.schoolId, schoolId), inArray(academicFeeCharges.enrollmentId, formerIds)));
    const chargeIds = charges.map((row) => row.id);
    if (chargeIds.length) {
      const allocations = await db.select().from(academicPaymentAllocations).where(inArray(academicPaymentAllocations.chargeId, chargeIds));
      const adjustments = await db.select().from(academicAdjustments).where(inArray(academicAdjustments.chargeId, chargeIds));
      formerPayments = allocations.reduce((sum, row) => sum + amountNumber(row.amount), 0);
      formerOutstanding = charges.reduce((sum, charge) => {
        const paid = allocations.filter((item) => item.chargeId === charge.id).reduce((value, item) => value + amountNumber(item.amount), 0);
        const adjusted = adjustments.filter((item) => item.chargeId === charge.id && ["waiver", "write_off", "credit", "correction"].includes(item.kind)).reduce((value, item) => value + amountNumber(item.amount), 0);
        const refunded = adjustments.filter((item) => item.chargeId === charge.id && item.kind === "refund").reduce((value, item) => value + amountNumber(item.amount), 0);
        return sum + Math.max(0, amountNumber(charge.amount) - paid + refunded - adjusted);
      }, 0);
    }
  }
  return {
    year, terms: summaries,
    promoted: decisions.filter((row) => row.decision === "promote").length,
    repeating: decisions.filter((row) => row.decision === "repeat").length,
    transferred: enrollments.filter((row) => row.status === "transferred").length,
    withdrawn: enrollments.filter((row) => row.status === "withdrawn").length,
    graduated: enrollments.filter((row) => row.status === "graduated").length,
    awaitingDecisions: decisions.filter((row) => row.decision === "hold").length,
    formerPupils: formerRows.length, formerOutstanding, formerPayments,
  };
}

export async function getStudentAcademicHistory(studentId: string) {
  const schemaState = await academicWorkspaceSchemaState();
  if (schemaState === "missing") return [];
  if (schemaState === "partial") throw new Error("Academic history database setup is incomplete.");
  const schoolId = await academicSchoolId();
  const rows = await db.select({ enrollment: academicEnrollments, year: academicYears })
    .from(academicEnrollments).innerJoin(academicYears, and(eq(academicEnrollments.academicYearId, academicYears.id), eq(academicEnrollments.schoolId, academicYears.schoolId)))
    .where(and(eq(academicEnrollments.schoolId, schoolId), eq(academicEnrollments.studentId, studentId)))
    .orderBy(academicYears.year);
  const enrollmentIds = rows.map(({ enrollment }) => enrollment.id);
  const charges = enrollmentIds.length ? await db.select().from(academicFeeCharges).where(and(eq(academicFeeCharges.schoolId, schoolId), inArray(academicFeeCharges.enrollmentId, enrollmentIds))) : [];
  const chargeIds = charges.map((charge) => charge.id);
  const terms = chargeIds.length ? await db.select().from(academicTerms).where(and(eq(academicTerms.schoolId, schoolId), inArray(academicTerms.id, [...new Set(charges.map((charge) => charge.termId))]))) : [];
  const allocations = chargeIds.length ? await db.select().from(academicPaymentAllocations).where(and(eq(academicPaymentAllocations.schoolId, schoolId), inArray(academicPaymentAllocations.chargeId, chargeIds))) : [];
  const paymentDetails = chargeIds.length ? await db.select({ allocation: academicPaymentAllocations, payment: payments })
    .from(academicPaymentAllocations).innerJoin(payments, and(eq(academicPaymentAllocations.paymentId, payments.id), eq(academicPaymentAllocations.schoolId, payments.schoolId)))
    .where(inArray(academicPaymentAllocations.chargeId, chargeIds)) : [];
  const adjustments = chargeIds.length ? await db.select().from(academicAdjustments).where(and(eq(academicAdjustments.schoolId, schoolId), inArray(academicAdjustments.chargeId, chargeIds))) : [];
  const departures = enrollmentIds.length
    ? await db.select().from(academicDepartures).where(and(eq(academicDepartures.schoolId, schoolId), inArray(academicDepartures.enrollmentId, enrollmentIds)))
    : [];
  const decisions = enrollmentIds.length
    ? await db.select().from(promotionDecisions).where(and(eq(promotionDecisions.schoolId, schoolId), inArray(promotionDecisions.enrollmentId, enrollmentIds)))
    : [];
  return {
    enrollments: rows.map(({ enrollment, year }) => ({ ...enrollment, year: year.year })),
    departures,
    promotionHistory: decisions,
    charges: charges.map((charge) => ({
      ...charge, termNumber: terms.find((term) => term.id === charge.termId)?.number,
      paid: allocations.filter((item) => item.chargeId === charge.id).reduce((sum, item) => sum + amountNumber(item.amount), 0),
      adjustments: adjustments.filter((item) => item.chargeId === charge.id),
      payments: paymentDetails.filter(({ allocation }) => allocation.chargeId === charge.id).map(({ allocation, payment }) => ({
        paymentId: payment.id, receiptNumber: payment.receiptNumber, amount: amountNumber(allocation.amount),
        paidOn: payment.paidOn, method: payment.method, reference: payment.reference, recordedBy: allocation.recordedBy,
      })),
    })),
  };
}