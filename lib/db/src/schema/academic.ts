import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { schoolSettings, students, users, payments } from "./index";

export const academicYears = pgTable("academic_years", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  status: text("status").notNull().default("draft"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("academic_year_school_year_idx").on(table.schoolId, table.year),
  uniqueIndex("academic_year_school_id_idx").on(table.schoolId, table.id),
  index("academic_year_school_status_idx").on(table.schoolId, table.status),
  check("academic_year_status_valid", sql`${table.status} in ('draft', 'current', 'closed')`),
  check("academic_year_year_valid", sql`${table.year} between 1900 and 2200`),
]);

export const academicTerms = pgTable("academic_terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  number: integer("number").notNull(),
  status: text("status").notNull().default("planned"),
  startsOn: date("starts_on", { mode: "string" }),
  endsOn: date("ends_on", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("academic_term_year_number_idx").on(table.schoolId, table.academicYearId, table.number),
  uniqueIndex("academic_term_school_id_year_idx").on(table.schoolId, table.id, table.academicYearId),
  index("academic_term_school_status_idx").on(table.schoolId, table.status),
  check("academic_term_number_valid", sql`${table.number} between 1 and 3`),
  check("academic_term_status_valid", sql`${table.status} in ('planned', 'open', 'closed')`),
  check("academic_term_date_range_valid", sql`(${table.startsOn} is null and ${table.endsOn} is null) or (${table.startsOn} is not null and ${table.endsOn} is not null and ${table.startsOn} <= ${table.endsOn})`),
  foreignKey({ name: "academic_terms_school_year_fk", columns: [table.schoolId, table.academicYearId], foreignColumns: [academicYears.schoolId, academicYears.id] }).onDelete("restrict"),
]);

export const academicEnrollments = pgTable("academic_enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "restrict" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  className: text("class_name").notNull(),
  stream: text("stream").notNull().default(""),
  status: text("status").notNull().default("active"),
  decision: text("decision"),
  repeating: boolean("repeating").notNull().default(false),
  enrolledOn: date("enrolled_on", { mode: "string" }).notNull(),
  endedOn: date("ended_on", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("academic_enrollment_school_id_idx").on(table.schoolId, table.id),
  uniqueIndex("academic_enrollment_student_year_idx").on(table.schoolId, table.studentId, table.academicYearId),
  uniqueIndex("academic_enrollment_school_id_student_year_idx").on(table.schoolId, table.id, table.studentId, table.academicYearId),
  index("academic_enrollment_year_status_idx").on(table.schoolId, table.academicYearId, table.status),
  index("academic_enrollment_student_idx").on(table.studentId),
  check("academic_enrollment_status_valid", sql`${table.status} in ('active', 'completed', 'transferred', 'withdrawn', 'graduated')`),
  check("academic_enrollment_decision_valid", sql`${table.decision} is null or ${table.decision} in ('promote', 'repeat', 'transfer', 'withdraw', 'graduate', 'hold')`),
  foreignKey({ name: "academic_enrollment_school_student_fk", columns: [table.schoolId, table.studentId], foreignColumns: [students.schoolId, students.id] }).onDelete("restrict"),
  foreignKey({ name: "academic_enrollment_school_year_fk", columns: [table.schoolId, table.academicYearId], foreignColumns: [academicYears.schoolId, academicYears.id] }).onDelete("restrict"),
]);

export const academicFeeCharges = pgTable("academic_fee_charges", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  enrollmentId: uuid("enrollment_id").notNull().references(() => academicEnrollments.id, { onDelete: "restrict" }),
  studentId: uuid("student_id").notNull(),
  academicYearId: uuid("academic_year_id").notNull(),
  termId: uuid("term_id").notNull().references(() => academicTerms.id, { onDelete: "restrict" }),
  category: text("category").notNull().default("tuition"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description").notNull().default(""),
  idempotencyKey: text("idempotency_key").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("academic_fee_school_id_idx").on(table.schoolId, table.id),
  uniqueIndex("academic_fee_school_id_student_year_term_idx").on(table.schoolId, table.id, table.studentId, table.academicYearId, table.termId),
  uniqueIndex("academic_fee_enrollment_term_category_idx").on(table.enrollmentId, table.termId, sql`lower(regexp_replace(btrim(${table.category}), '[[:space:]]+', ' ', 'g'))`),
  uniqueIndex("academic_fee_idempotency_idx").on(table.schoolId, table.idempotencyKey),
  index("academic_fee_term_idx").on(table.schoolId, table.termId),
  check("academic_fee_amount_nonnegative", sql`${table.amount} >= 0`),
  check("academic_fee_category_nonblank", sql`length(btrim(${table.category})) > 0`),
  check("academic_fee_idempotency_nonblank", sql`length(btrim(${table.idempotencyKey})) > 0`),
  foreignKey({
    name: "academic_fee_enrollment_tenant_fk",
    columns: [table.schoolId, table.enrollmentId, table.studentId, table.academicYearId],
    foreignColumns: [academicEnrollments.schoolId, academicEnrollments.id, academicEnrollments.studentId, academicEnrollments.academicYearId],
  }).onDelete("restrict"),
  foreignKey({
    name: "academic_fee_term_year_fk",
    columns: [table.schoolId, table.termId, table.academicYearId],
    foreignColumns: [academicTerms.schoolId, academicTerms.id, academicTerms.academicYearId],
  }).onDelete("restrict"),
]);

export const academicFeeSchedules = pgTable("academic_fee_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull(),
  termId: uuid("term_id").notNull(),
  className: text("class_name").notNull(),
  stream: text("stream").notNull().default(""),
  enrollmentType: text("enrollment_type").notNull().default(""),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description").notNull().default(""),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  updatedBy: uuid("updated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("academic_fee_schedule_identity_idx").on(
    table.schoolId, table.termId,
    sql`lower(regexp_replace(btrim(${table.className}), '[[:space:]]+', ' ', 'g'))`,
    sql`lower(regexp_replace(btrim(${table.stream}), '[[:space:]]+', ' ', 'g'))`,
    sql`lower(btrim(${table.enrollmentType}))`,
    sql`lower(regexp_replace(btrim(${table.category}), '[[:space:]]+', ' ', 'g'))`,
  ),
  index("academic_fee_schedule_term_idx").on(table.schoolId, table.termId),
  check("academic_fee_schedule_class_nonblank", sql`length(btrim(${table.className})) > 0`),
  check("academic_fee_schedule_amount_nonnegative", sql`${table.amount} >= 0`),
  check("academic_fee_schedule_category_nonblank", sql`length(btrim(${table.category})) > 0`),
  check("academic_fee_schedule_enrollment_type_valid", sql`${table.enrollmentType} in ('', 'day', 'boarding')`),
  foreignKey({
    name: "academic_fee_schedule_school_term_year_fk",
    columns: [table.schoolId, table.termId, table.academicYearId],
    foreignColumns: [academicTerms.schoolId, academicTerms.id, academicTerms.academicYearId],
  }).onDelete("restrict"),
]);

export const academicPaymentAllocations = pgTable("academic_payment_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "restrict" }),
  chargeId: uuid("charge_id").notNull().references(() => academicFeeCharges.id, { onDelete: "restrict" }),
  studentId: uuid("student_id").notNull(),
  academicYearId: uuid("academic_year_id").notNull(),
  termId: uuid("term_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("academic_payment_idempotency_idx").on(table.schoolId, table.idempotencyKey),
  index("academic_payment_charge_idx").on(table.schoolId, table.chargeId),
  index("academic_payment_payment_idx").on(table.paymentId),
  check("academic_payment_allocation_positive", sql`${table.amount} > 0`),
  check("academic_payment_idempotency_nonblank", sql`length(btrim(${table.idempotencyKey})) > 0`),
  foreignKey({
    name: "academic_payment_school_pupil_fk",
    columns: [table.schoolId, table.paymentId, table.studentId],
    foreignColumns: [payments.schoolId, payments.id, payments.studentId],
  }).onDelete("restrict"),
  foreignKey({
    name: "academic_payment_charge_term_fk",
    columns: [table.schoolId, table.chargeId, table.studentId, table.academicYearId, table.termId],
    foreignColumns: [academicFeeCharges.schoolId, academicFeeCharges.id, academicFeeCharges.studentId, academicFeeCharges.academicYearId, academicFeeCharges.termId],
  }).onDelete("restrict"),
  foreignKey({
    name: "academic_payment_school_term_fk",
    columns: [table.schoolId, table.termId, table.academicYearId],
    foreignColumns: [academicTerms.schoolId, academicTerms.id, academicTerms.academicYearId],
  }).onDelete("restrict"),
]);

export const academicAdjustments = pgTable("academic_adjustments", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  chargeId: uuid("charge_id").notNull().references(() => academicFeeCharges.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  notes: text("notes").notNull().default(""),
  authorizedBy: uuid("authorized_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  adjustedOn: date("adjusted_on", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("academic_adjustment_charge_idx").on(table.schoolId, table.chargeId),
  check("academic_adjustment_kind_valid", sql`${table.kind} in ('waiver', 'write_off', 'credit', 'refund', 'correction')`),
  check("academic_adjustment_amount_positive", sql`${table.amount} > 0`),
  check("academic_adjustment_reason_nonblank", sql`length(btrim(${table.reason})) >= 3`),
  foreignKey({ name: "academic_adjustment_school_charge_fk", columns: [table.schoolId, table.chargeId], foreignColumns: [academicFeeCharges.schoolId, academicFeeCharges.id] }).onDelete("restrict"),
]);

export const academicDepartures = pgTable("academic_departures", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  enrollmentId: uuid("enrollment_id").notNull().references(() => academicEnrollments.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(),
  leavingOn: date("leaving_on", { mode: "string" }).notNull(),
  reason: text("reason").notNull(),
  destinationSchool: text("destination_school"),
  remarks: text("remarks").notNull().default(""),
  processedBy: uuid("processed_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("academic_departure_enrollment_idx").on(table.enrollmentId),
  check("academic_departure_kind_valid", sql`${table.kind} in ('transferred', 'withdrawn')`),
  check("academic_departure_reason_nonblank", sql`length(btrim(${table.reason})) >= 3`),
  foreignKey({ name: "academic_departure_school_enrollment_fk", columns: [table.schoolId, table.enrollmentId], foreignColumns: [academicEnrollments.schoolId, academicEnrollments.id] }).onDelete("restrict"),
]);

export const promotionCycles = pgTable("academic_promotion_cycles", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  fromYearId: uuid("from_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  toYearId: uuid("to_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("review"),
  confirmedBy: uuid("confirmed_by").references(() => users.id, { onDelete: "set null" }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("academic_promotion_cycle_once_idx").on(table.schoolId, table.fromYearId, table.toYearId),
  uniqueIndex("academic_promotion_cycle_school_id_idx").on(table.schoolId, table.id),
  check("academic_promotion_status_valid", sql`${table.status} in ('review', 'confirmed')`),
  foreignKey({ name: "academic_promotion_from_year_tenant_fk", columns: [table.schoolId, table.fromYearId], foreignColumns: [academicYears.schoolId, academicYears.id] }).onDelete("restrict"),
  foreignKey({ name: "academic_promotion_to_year_tenant_fk", columns: [table.schoolId, table.toYearId], foreignColumns: [academicYears.schoolId, academicYears.id] }).onDelete("restrict"),
]);

export const promotionDecisions = pgTable("academic_promotion_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  cycleId: uuid("cycle_id").notNull().references(() => promotionCycles.id, { onDelete: "restrict" }),
  enrollmentId: uuid("enrollment_id").notNull().references(() => academicEnrollments.id, { onDelete: "restrict" }),
  decision: text("decision").notNull(),
  nextClassName: text("next_class_name"),
  nextStream: text("next_stream"),
  recommendation: text("recommendation").notNull().default(""),
  approvalNotes: text("approval_notes").notNull().default(""),
  reviewedBy: uuid("reviewed_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("academic_promotion_decision_once_idx").on(table.cycleId, table.enrollmentId),
  check("academic_promotion_decision_valid", sql`${table.decision} in ('promote', 'repeat', 'transfer', 'withdraw', 'graduate', 'hold')`),
  foreignKey({ name: "academic_promotion_decision_cycle_tenant_fk", columns: [table.schoolId, table.cycleId], foreignColumns: [promotionCycles.schoolId, promotionCycles.id] }).onDelete("restrict"),
  foreignKey({ name: "academic_promotion_decision_enrollment_tenant_fk", columns: [table.schoolId, table.enrollmentId], foreignColumns: [academicEnrollments.schoolId, academicEnrollments.id] }).onDelete("restrict"),
]);

export type AcademicYear = typeof academicYears.$inferSelect;
export type AcademicTerm = typeof academicTerms.$inferSelect;
export type AcademicEnrollment = typeof academicEnrollments.$inferSelect;
export type AcademicFeeCharge = typeof academicFeeCharges.$inferSelect;
export type AcademicFeeSchedule = typeof academicFeeSchedules.$inferSelect;
export type AcademicPaymentAllocation = typeof academicPaymentAllocations.$inferSelect;
export type AcademicAdjustment = typeof academicAdjustments.$inferSelect;
export type AcademicDeparture = typeof academicDepartures.$inferSelect;
export type PromotionCycle = typeof promotionCycles.$inferSelect;
export type PromotionDecision = typeof promotionDecisions.$inferSelect;