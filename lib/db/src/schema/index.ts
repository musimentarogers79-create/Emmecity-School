import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const schoolSettings = pgTable("school_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolName: text("school_name").notNull(),
  academicYear: text("academic_year").notNull().default("2026"),
  currencyCode: text("currency_code").notNull().default("UGX"),
  currencyName: text("currency_name").notNull().default("Ugandan Shilling"),
  currencySymbol: text("currency_symbol").notNull().default("UGX"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("school_settings_name_idx").on(table.schoolName)]);

const auditColumns = {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  registrationNumber: text("registration_number").notNull(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  className: text("class_name").notNull(),
  stream: text("stream").notNull(),
  gender: text("gender").notNull(),
  status: text("status").notNull().default("active"),
  attendancePercentage: integer("attendance_percentage").notNull().default(100),
  feeBalance: numeric("fee_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  avatarTone: text("avatar_tone").notNull().default("mint"),
  dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
  guardianName: text("guardian_name").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  guardianEmail: text("guardian_email").notNull().default(""),
  admissionDate: date("admission_date", { mode: "string" }).notNull(),
  enrollmentType: text("enrollment_type"),
  termFee: numeric("term_fee", { precision: 14, scale: 2 }),
  amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("students_registration_idx").on(table.schoolId, table.registrationNumber),
  unique("students_school_id_unique").on(table.id, table.schoolId),
  index("students_class_idx").on(table.schoolId, table.className, table.stream),
  check("students_fee_balance_nonnegative", sql`${table.feeBalance} >= 0`),
  check("students_amount_paid_nonnegative", sql`${table.amountPaid} >= 0`),
]);

export const users = pgTable("school_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  identifier: text("identifier").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  userType: text("user_type").notNull(),
  role: text("role").notNull(),
  initials: text("initials").notNull(),
  studentId: uuid("student_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("school_users_identifier_idx").on(table.schoolId, table.identifier),
  index("school_users_student_idx").on(table.studentId),
  foreignKey({
    name: "school_users_school_student_fk",
    columns: [table.schoolId, table.studentId],
    foreignColumns: [students.schoolId, students.id],
  }).onDelete("restrict"),
]);

export const sessions = pgTable("school_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("school_sessions_token_idx").on(table.tokenHash), index("school_sessions_expiry_idx").on(table.expiresAt)]);

export const loginAttempts = pgTable("school_login_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  keyHash: text("key_hash").notNull(),
  count: integer("count").notNull().default(1),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("school_login_attempts_key_idx").on(table.keyHash),
  index("school_login_attempts_reset_idx").on(table.resetAt),
  check("school_login_attempts_count_positive", sql`${table.count} > 0`),
]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull(),
  studentId: uuid("student_id").notNull(),
  receiptNumber: text("receipt_number").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  method: text("method").notNull(),
  reference: text("reference").notNull().default(""),
  paidOn: date("paid_on", { mode: "string" }).notNull(),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("payments_receipt_idx").on(table.schoolId, table.receiptNumber),
  index("payments_student_idx").on(table.studentId),
  check("payments_amount_positive", sql`${table.amount} > 0`),
  foreignKey({
    name: "payments_school_student_fk",
    columns: [table.schoolId, table.studentId],
    foreignColumns: [students.schoolId, students.id],
  }).onDelete("restrict"),
]);

export const attendance = pgTable("attendance", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull(),
  studentId: uuid("student_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("attendance_student_date_idx").on(table.studentId, table.date),
  index("attendance_school_date_idx").on(table.schoolId, table.date),
  foreignKey({
    name: "attendance_school_student_fk",
    columns: [table.schoolId, table.studentId],
    foreignColumns: [students.schoolId, students.id],
  }).onDelete("cascade"),
]);

export const recordSequences = pgTable("school_record_sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: uuid("school_id").notNull().references(() => schoolSettings.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  kind: text("kind").notNull(),
  value: integer("value").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("school_record_sequences_scope_idx").on(table.schoolId, table.year, table.kind),
  check("school_record_sequences_value_positive", sql`${table.value} > 0`),
]);

export const expenses = pgTable("expenses", auditColumns);
export const salaryPayments = pgTable("salary_payments", auditColumns);
export const announcements = pgTable("announcements", auditColumns);
export const classes = pgTable("classes", auditColumns);
export const subjects = pgTable("subjects", auditColumns);
export const assignments = pgTable("assignments", auditColumns);
export const staff = pgTable("staff", auditColumns);
export const parents = pgTable("parents", auditColumns);
export const guardians = pgTable("guardians", auditColumns);
export const discipline = pgTable("discipline", auditColumns);
export const medical = pgTable("medical", auditColumns);
export const library = pgTable("library", auditColumns);
export const transport = pgTable("transport", auditColumns);
export const inventory = pgTable("inventory", auditColumns);
export const events = pgTable("events", auditColumns);
export const documents = pgTable("documents", auditColumns);
export const reports = pgTable("reports", auditColumns);
export const notifications = pgTable("notifications", auditColumns);
export const timetable = pgTable("timetable", auditColumns);

export const insertSchoolSettingsSchema = createInsertSchema(schoolSettings);
export type SchoolSettings = typeof schoolSettings.$inferSelect;
export type InsertSchoolSettings = z.infer<typeof insertSchoolSettingsSchema>;
export type User = typeof users.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type OperationRecord = typeof expenses.$inferSelect;