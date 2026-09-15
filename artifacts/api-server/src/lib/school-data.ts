import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, gt, ilike, lt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  announcements, attendance, assignments, classes, discipline, documents, events, expenses,
  inventory, library, loginAttempts, medical, notifications, parents, payments, reports, salaryPayments, schoolSettings,
  recordSequences, sessions, staff, students, subjects, timetable, transport, users,
} from "@workspace/db";
import type { SchoolSettings, User } from "@workspace/db";

export type SchoolRole = "super_admin" | "administrator" | "teacher" | "accountant" | "guardian" | "student" | "staff";
export type PermissionKey = "expense_approve" | "expense_delete" | "transactions_view" | "transactions_print" | "finance_view" | "expenses_view" | "manage_users";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type SchoolUser = {
  id: string; name: string; identifier: string; email: string; phone: string; password: string; userType: "staff" | "guardian" | "learner";
  role: SchoolRole; permissions: PermissionKey[]; initials: string; schoolName: string; studentId?: string; assignedClasses?: string[]; monthlySalary?: number;
};
export type SchoolStudent = {
  id: string; registrationNumber: string; name: string; firstName: string; lastName: string; middleName?: string;
  className: string; stream: string; gender: string; status: "active" | "inactive"; attendancePercentage: number;
  feeBalance: number; avatarTone: string; dateOfBirth: string; guardianName: string; guardianPhone: string;
  guardianEmail: string; admissionDate: string; enrollmentType?: "day" | "boarding"; termFee?: number; amountPaid?: number;
};
export type AttendanceRecord = { id: string; studentId: string; studentName: string; registrationNumber: string; className: string; date: string; status: AttendanceStatus; arrivalTime?: string | null };
export type Payment = { id: string; studentId: string; receiptNumber: string; studentName: string; registrationNumber: string; amount: number; method: string; date: string; status: "completed" | "pending" | "reversed"; balance: number };
export type OperationRecord = Record<string, unknown> & { id: string };
export const classAssignmentKey = (name: string, stream?: string | null) => {
  const normalizedName = name.trim();
  const normalizedStream = String(stream ?? "").trim();
  return normalizedStream ? `${normalizedName} ${normalizedStream}` : normalizedName;
};

const SCHOOL_NAME = "EMMECTY NURSERY & PRIMARY SCHOOL";
const CURRENCIES = [
  { code: "UGX", name: "Ugandan Shilling", symbol: "UGX" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KES" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TZS" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
] as const;

export const currencyOptions = [...CURRENCIES];

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, storedPassword: string) {
  const [salt, storedHash] = storedPassword.split(":");
  if (!salt || !storedHash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const number = (value: string | number | null | undefined) => Number(value ?? 0);
export const getDateLabel = () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const isoDate = () => new Date().toISOString().slice(0, 10);

let bootstrapPromise: Promise<string> | undefined;
export async function initializeSchoolData() {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    let setting = (await db.select().from(schoolSettings).orderBy(asc(schoolSettings.createdAt)).limit(1))[0];
    if (!setting) {
      await db.insert(schoolSettings).values({
        schoolName: SCHOOL_NAME, academicYear: "2026", currencyCode: "UGX", currencyName: "Ugandan Shilling", currencySymbol: "UGX",
      }).onConflictDoNothing({ target: schoolSettings.schoolName });
      setting = (await db.select().from(schoolSettings).orderBy(asc(schoolSettings.createdAt)).limit(1))[0];
    }
    if (!setting) throw new Error("Unable to initialize school settings");
    const admins = await db.select().from(users).where(and(eq(users.schoolId, setting.id), eq(users.identifier, "admin"))).limit(1);
    const production = process.env["NODE_ENV"] === "production";
    const configuredPassword = process.env["SCHOOL_BOOTSTRAP_PASSWORD"];
    if (production && !configuredPassword && (!admins[0] || verifyPassword("admin123", admins[0].passwordHash))) {
      throw new Error("SCHOOL_BOOTSTRAP_PASSWORD must be configured before the first production start");
    }
    if (!admins[0]) {
      await db.insert(users).values({
        schoolId: setting.id, name: "School administrator", identifier: "admin", passwordHash: hashPassword(configuredPassword || "admin123"),
        userType: "staff", role: "administrator", initials: "SA",
      }).onConflictDoNothing({ target: [users.schoolId, users.identifier] });
    } else if (production && configuredPassword && verifyPassword("admin123", admins[0].passwordHash)) {
      await db.update(users).set({ passwordHash: hashPassword(configuredPassword), updatedAt: new Date() }).where(eq(users.id, admins[0].id));
    }
    return setting.id;
  })();
  try { return await bootstrapPromise; } catch (error) { bootstrapPromise = undefined; throw error; }
}
export async function getSchoolId() { return initializeSchoolData(); }

function publicRow(row: User, setting: SchoolSettings): SchoolUser {
  const permissions = Array.isArray(row.permissions) ? row.permissions.filter((item): item is PermissionKey => ["expense_approve", "expense_delete", "transactions_view", "transactions_print", "finance_view", "expenses_view", "manage_users"].includes(item)) : [];
  return { id: row.id, name: row.name, identifier: row.identifier, email: row.email, phone: row.phone, password: row.passwordHash, userType: row.userType as SchoolUser["userType"], role: row.role as SchoolRole, permissions, initials: row.initials, schoolName: setting.schoolName, ...(row.studentId ? { studentId: row.studentId } : {}), ...(row.monthlySalary !== null ? { monthlySalary: number(row.monthlySalary) } : {}) };
}
export function publicUser(user: SchoolUser) {
  return { id: user.id, name: user.name, identifier: user.identifier, email: user.email, phone: user.phone, role: user.role, permissions: user.permissions, initials: user.initials, schoolName: user.schoolName, studentId: user.studentId ?? null, ...(user.assignedClasses ? { assignedClasses: user.assignedClasses } : {}), ...(user.monthlySalary !== undefined ? { monthlySalary: user.monthlySalary } : {}) };
}
export async function getSchoolSettings() {
  const id = await getSchoolId();
  const rows = await db.select().from(schoolSettings).where(eq(schoolSettings.id, id)).limit(1);
  if (!rows[0]) throw new Error("School settings not found");
  return rows[0];
}
export async function updateSchoolSettings(data: Partial<Pick<SchoolSettings, "schoolName" | "academicYear" | "currencyCode" | "currencyName" | "currencySymbol">>) {
  const id = await getSchoolId();
  const row = (await db.update(schoolSettings).set({ ...data, updatedAt: new Date() }).where(eq(schoolSettings.id, id)).returning())[0];
  if (!row) throw new Error("School settings not found");
  return row;
}
export async function listUsers() {
  const [setting, rows] = await Promise.all([getSchoolSettings(), db.select().from(users)]);
  const classRows = await listOperation("classes");
  return rows.filter((row) => row.schoolId === setting.id).map((row) => {
    const user = publicRow(row, setting);
    return user.role === "teacher" ? { ...user, assignedClasses: classRows.filter((item) => item.teacherId === user.id).map((item) => classAssignmentKey(String(item.name), String(item.stream ?? ""))) } : user;
  });
}
export async function findUser(identifier: string, userType: string) {
  const schoolId = await getSchoolId();
  const rows = await db.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.userType, userType), ilike(users.identifier, identifier))).limit(1);
  const setting = await getSchoolSettings();
  return rows[0] ? publicRow(rows[0], setting) : undefined;
}
export async function findUserById(id: string) {
  const schoolId = await getSchoolId();
  const rows = await db.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.id, id))).limit(1);
  const setting = await getSchoolSettings();
  return rows[0] ? publicRow(rows[0], setting) : undefined;
}
export async function createUser(data: {
  name: string; identifier: string; password: string; userType: string; role: SchoolRole; studentId?: string;
  email?: string; phone?: string; address?: string; nextOfKin?: string; hireDate?: string; employmentType?: string; permissions?: PermissionKey[]; assignedClasses?: string[]; monthlySalary?: number;
}) {
  const schoolId = await getSchoolId();
  const row = (await db.insert(users).values({
    schoolId, name: data.name, identifier: data.identifier, email: data.email || "", phone: data.phone || "",
    passwordHash: hashPassword(data.password), userType: data.userType, role: data.role, permissions: data.permissions || [], initials: initials(data.name), studentId: data.studentId, monthlySalary: data.monthlySalary ? String(data.monthlySalary) : null,
  }).returning())[0];
  if (!row) throw new Error("Unable to create account");
  if (data.userType === "staff") {
    await db.insert(staff).values({
      schoolId,
      data: {
        userId: row.id, name: data.name, role: data.role.replace("_", " "), username: data.identifier, email: data.email || "",
         phone: data.phone || "Not provided", address: data.address || "", nextOfKin: data.nextOfKin || "", monthlySalary: data.monthlySalary || 0,
        hireDate: data.hireDate || "", employmentType: data.employmentType || "Full-time", status: "Active",
      },
    });
  }
  if (data.role === "teacher" && data.assignedClasses?.length) {
    const classRows = await listOperation("classes");
    await Promise.all(classRows
      .filter((item) => data.assignedClasses?.includes(classAssignmentKey(String(item.name), String(item.stream ?? ""))))
      .map((item) => updateOperation("classes", item.id, { ...item, teacherId: row.id, teacherName: data.name })));
  }
  const publicUser = publicRow(row, await getSchoolSettings());
  if (data.role !== "teacher") return publicUser;
  const classRows = await listOperation("classes");
  const assignedClasses = classRows
    .filter((item) => item.teacherId === row.id)
    .map((item) => classAssignmentKey(String(item.name), String(item.stream ?? "")));
  const registrationForm = {
    documentType: "teacher_registration_form",
    title: "Teacher Registration Form",
    userId: row.id,
    name: data.name,
    username: data.identifier,
    email: data.email || "",
    phone: data.phone || "",
    address: data.address || "",
    nextOfKin: data.nextOfKin || "",
    hireDate: data.hireDate || "",
    employmentType: data.employmentType || "Full-time",
    monthlySalary: data.monthlySalary || 0,
    assignedClasses,
    permissions: data.permissions || [],
    registeredAt: new Date().toISOString(),
  };
  const document = (await db.insert(documents).values({ schoolId, data: registrationForm }).returning())[0];
  return document ? { ...publicUser, assignedClasses, registrationForm: { ...registrationForm, id: document.id } } : { ...publicUser, assignedClasses };
}
export async function updateUserProfile(user: SchoolUser, data: {
  name?: string; identifier?: string; email?: string; phone?: string; newPassword?: string;
}) {
  const schoolId = await getSchoolId();
  const updates: Partial<User> = { updatedAt: new Date() };
  if (data.name !== undefined) {
    updates.name = data.name.trim();
    updates.initials = initials(data.name);
  }
  if (data.identifier !== undefined) updates.identifier = data.identifier.trim();
  if (data.email !== undefined) updates.email = data.email.trim();
  if (data.phone !== undefined) updates.phone = data.phone.trim();
  if (data.newPassword !== undefined) updates.passwordHash = hashPassword(data.newPassword);
  const row = (await db.update(users).set(updates).where(and(eq(users.schoolId, schoolId), eq(users.id, user.id))).returning())[0];
  if (!row) throw new Error("Account not found");
  return publicRow(row, await getSchoolSettings());
}
export async function updateUserPermissions(userId: string, permissions: PermissionKey[], assignedClasses?: string[]) {
  const schoolId = await getSchoolId();
  const row = (await db.update(users).set({ permissions, updatedAt: new Date() }).where(and(eq(users.schoolId, schoolId), eq(users.id, userId))).returning())[0];
  if (!row) return undefined;
  if (row.role === "teacher" && assignedClasses !== undefined) {
    const classRows = await listOperation("classes");
    await Promise.all(classRows.map((item) => {
      const isAssigned = assignedClasses.includes(classAssignmentKey(String(item.name), String(item.stream ?? "")));
      if (item.teacherId === row.id && !isAssigned) return updateOperation("classes", item.id, { ...item, teacherId: null, teacherName: "Unassigned" });
      if (isAssigned) return updateOperation("classes", item.id, { ...item, teacherId: row.id, teacherName: row.name });
      return undefined;
    }));
  }
  const setting = await getSchoolSettings();
  const user = publicRow(row, setting);
  return row.role === "teacher" ? { ...user, assignedClasses: (await listOperation("classes")).filter((item) => item.teacherId === row.id).map((item) => classAssignmentKey(String(item.name), String(item.stream ?? ""))) } : user;
}

const tokenDigest = (token: string) => createHash("sha256").update(token).digest("hex");
export async function makeSession(userId: string) {
  const token = randomUUID();
  await db.insert(sessions).values({ userId, tokenHash: tokenDigest(token), expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) });
  return token;
}
export async function deleteSession(token: string) { await db.delete(sessions).where(eq(sessions.tokenHash, tokenDigest(token))); }
export async function currentUserFromToken(token: string | undefined) {
  if (!token) return undefined;
  const row = (await db.select().from(sessions).where(and(eq(sessions.tokenHash, tokenDigest(token)), gt(sessions.expiresAt, new Date()))).limit(1))[0];
  return row ? findUserById(row.userId) : undefined;
}

const loginAttemptDigest = (key: string) => createHash("sha256").update(key).digest("hex");
export async function consumeLoginAttempt(key: string) {
  const keyHash = loginAttemptDigest(key);
  const now = new Date();
  const resetAt = new Date(now.getTime() + 15 * 60 * 1000);
  const row = (await db.insert(loginAttempts).values({ keyHash, count: 1, resetAt }).onConflictDoUpdate({
    target: loginAttempts.keyHash,
    set: {
      count: sql`case when ${loginAttempts.resetAt} <= ${now} then 1 else ${loginAttempts.count} + 1 end`,
      resetAt: sql`case when ${loginAttempts.resetAt} <= ${now} then ${resetAt} else ${loginAttempts.resetAt} end`,
      updatedAt: now,
    },
  }).returning({ count: loginAttempts.count }))[0];
  return !!row && row.count <= 5;
}
export async function clearLoginFailures(key: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.keyHash, loginAttemptDigest(key)));
}

function studentRow(row: typeof students.$inferSelect): SchoolStudent {
  const result: SchoolStudent = {
    id: row.id, registrationNumber: row.registrationNumber, name: `${row.firstName}${row.middleName ? ` ${row.middleName}` : ""} ${row.lastName}`,
    firstName: row.firstName, lastName: row.lastName, className: row.className, stream: row.stream, gender: row.gender,
    status: row.status as SchoolStudent["status"], attendancePercentage: row.attendancePercentage, feeBalance: number(row.feeBalance),
    avatarTone: row.avatarTone, dateOfBirth: row.dateOfBirth, guardianName: row.guardianName, guardianPhone: row.guardianPhone,
    guardianEmail: row.guardianEmail, admissionDate: row.admissionDate,
  };
  if (row.middleName) result.middleName = row.middleName;
  if (row.enrollmentType) result.enrollmentType = row.enrollmentType as "day" | "boarding";
  if (row.termFee !== null) result.termFee = number(row.termFee);
  if (row.amountPaid !== null) result.amountPaid = number(row.amountPaid);
  return result;
}
export async function listStudents() {
  const schoolId = await getSchoolId();
  return (await db.select().from(students).where(eq(students.schoolId, schoolId)).orderBy(desc(students.createdAt))).map(studentRow);
}
export async function getStudent(id: string) {
  const schoolId = await getSchoolId();
  const row = (await db.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.id, id))).limit(1))[0];
  if (row) return studentRow(row);
  const byRegistration = (await db.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.registrationNumber, id))).limit(1))[0];
  return byRegistration ? studentRow(byRegistration) : undefined;
}
export async function updateStudent(id: string, data: {
  firstName?: string; middleName?: string; lastName?: string; dateOfBirth?: string; gender?: string;
  className?: string; stream?: string; guardianName?: string; guardianPhone?: string; guardianEmail?: string;
  enrollmentType?: "day" | "boarding"; termFee?: number; status?: "active" | "inactive"; newPassword?: string;
}) {
  const schoolId = await getSchoolId();
  const current = (await db.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.id, id))).limit(1))[0];
  if (!current) return undefined;
  const updates: Partial<typeof students.$inferInsert> = { updatedAt: new Date() };
  for (const key of ["firstName", "middleName", "lastName", "dateOfBirth", "gender", "className", "stream", "guardianName", "guardianPhone", "guardianEmail", "enrollmentType", "status"] as const) {
    if (data[key] !== undefined) updates[key] = data[key] as never;
  }
  if (data.termFee !== undefined) {
    updates.termFee = String(data.termFee);
    updates.feeBalance = String(Math.max(0, data.termFee - number(current.amountPaid)));
  }
  const updated = (await db.update(students).set(updates).where(and(eq(students.schoolId, schoolId), eq(students.id, id))).returning())[0];
  if (!updated) return undefined;
  const admission = (await db.select().from(documents).where(and(eq(documents.schoolId, schoolId), sql`${documents.data}->>'studentId' = ${id}`, sql`${documents.data}->>'documentType' = 'admission_form`)).orderBy(desc(documents.createdAt)).limit(1))[0];
  if (admission) {
    const currentForm = admission.data as Record<string, unknown>;
    await db.update(documents).set({
      data: {
        ...currentForm,
        pupilName: `${updated.firstName}${updated.middleName ? ` ${updated.middleName}` : ""} ${updated.lastName}`,
        dateOfBirth: updated.dateOfBirth,
        gender: updated.gender,
        className: updated.className,
        stream: updated.stream,
        guardianName: updated.guardianName,
        guardianPhone: updated.guardianPhone,
        enrollmentType: updated.enrollmentType,
        termFee: number(updated.termFee),
        amountPaid: number(updated.amountPaid),
        feeBalance: number(updated.feeBalance),
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    }).where(and(eq(documents.schoolId, schoolId), eq(documents.id, admission.id)));
  }
  if (data.newPassword) {
    await db.update(users).set({ passwordHash: hashPassword(data.newPassword), updatedAt: new Date() }).where(and(eq(users.schoolId, schoolId), eq(users.studentId, id), eq(users.role, "student")));
  }
  return studentRow(updated);
}
export async function getAdmissionForm(id: string) {
  const schoolId = await getSchoolId();
  const student = await getStudent(id);
  if (!student) return undefined;
  const row = (await db.select().from(documents).where(and(eq(documents.schoolId, schoolId), sql`${documents.data}->>'studentId' = ${student.id}`, sql`${documents.data}->>'documentType' = 'admission_form'`)).orderBy(desc(documents.createdAt)).limit(1))[0];
  return row ? { ...(row.data as Record<string, unknown>), id: row.id } : undefined;
}
export async function createStudentWithPayment(data: {
  firstName: string; middleName?: string; lastName: string; className: string; stream: string; gender: string; dateOfBirth: string;
  guardianName: string; guardianPhone: string; enrollmentType: "day" | "boarding"; termFee: number; initialPayment?: number; paymentMethod?: string; paymentReference?: string;
}) {
  const schoolId = await getSchoolId();
  return db.transaction(async (tx) => {
    const year = new Date().getFullYear();
    const countRows = await tx.select({ count: sql<number>`count(*)` }).from(students).where(and(eq(students.schoolId, schoolId), ilike(students.registrationNumber, `STU-${year}-%`)));
    const registrationSequence = (await tx.insert(recordSequences).values({
      schoolId, year, kind: "registration", value: Number(countRows[0]?.count ?? 0) + 1,
    }).onConflictDoUpdate({
      target: [recordSequences.schoolId, recordSequences.year, recordSequences.kind],
      set: { value: sql`${recordSequences.value} + 1`, updatedAt: new Date() },
    }).returning({ value: recordSequences.value }))[0];
    if (!registrationSequence) throw new Error("Unable to allocate registration number");
    const registrationNumber = `STU-${year}-${String(registrationSequence.value).padStart(4, "0")}`;
    const initialPayment = data.initialPayment ?? 0;
    if (initialPayment < 0 || initialPayment > data.termFee) throw new Error("Opening payment cannot exceed the term fee");
    const studentRowValue = (await tx.insert(students).values({
      schoolId, registrationNumber, firstName: data.firstName, middleName: data.middleName, lastName: data.lastName,
      className: data.className, stream: data.stream, gender: data.gender, dateOfBirth: data.dateOfBirth,
      guardianName: data.guardianName, guardianPhone: data.guardianPhone, admissionDate: isoDate(), enrollmentType: data.enrollmentType,
      termFee: String(data.termFee), amountPaid: String(initialPayment), feeBalance: String(Math.max(0, data.termFee - initialPayment)),
    }).returning())[0];
    if (!studentRowValue) throw new Error("Unable to register pupil");
    let payment: Payment | undefined;
    if (initialPayment > 0) {
      const receiptCount = await tx.select({ count: sql<number>`count(*)` }).from(payments).where(and(eq(payments.schoolId, schoolId), ilike(payments.receiptNumber, `RCPT-${year}-%`)));
      const receiptSequence = (await tx.insert(recordSequences).values({
        schoolId, year, kind: "receipt", value: Number(receiptCount[0]?.count ?? 0) + 1,
      }).onConflictDoUpdate({
        target: [recordSequences.schoolId, recordSequences.year, recordSequences.kind],
        set: { value: sql`${recordSequences.value} + 1`, updatedAt: new Date() },
      }).returning({ value: recordSequences.value }))[0];
      if (!receiptSequence) throw new Error("Unable to allocate receipt number");
      const receiptNumber = `RCPT-${year}-${String(receiptSequence.value).padStart(4, "0")}`;
      const paymentRow = (await tx.insert(payments).values({
        schoolId, studentId: studentRowValue.id, receiptNumber, amount: String(initialPayment), method: data.paymentMethod || "Cash",
        reference: data.paymentReference || "", paidOn: isoDate(), status: "completed",
      }).returning())[0];
      payment = paymentRow ? { id: paymentRow.id, studentId: studentRowValue.id, receiptNumber, studentName: `${data.firstName}${data.middleName ? ` ${data.middleName}` : ""} ${data.lastName}`, registrationNumber, amount: initialPayment, method: paymentRow.method, date: getDateLabel(), status: "completed", balance: Math.max(0, data.termFee - initialPayment) } : undefined;
    }
    const admissionFormData = {
      documentType: "admission_form",
      title: "Pupil Admission Form",
      studentId: studentRowValue.id,
      registrationNumber,
      pupilName: `${data.firstName}${data.middleName ? ` ${data.middleName}` : ""} ${data.lastName}`,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      className: data.className,
      stream: data.stream,
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
      admissionDate: studentRowValue.admissionDate,
      enrollmentType: data.enrollmentType,
      termFee: data.termFee,
      amountPaid: initialPayment,
      feeBalance: Math.max(0, data.termFee - initialPayment),
      generatedAt: new Date().toISOString(),
    };
    const admissionDocument = (await tx.insert(documents).values({ schoolId, data: admissionFormData }).returning())[0];
    if (!admissionDocument) throw new Error("Unable to save admission form");
    return { student: studentRow(studentRowValue), payment, admissionForm: { ...admissionFormData, id: admissionDocument.id } };
  });
}
export async function updateStudentBalance(studentId: string, amount: number) {
  const row = (await db.select().from(students).where(eq(students.id, studentId)).limit(1))[0];
  if (!row) return undefined;
  const updated = (await db.update(students).set({ feeBalance: sql`greatest(0, ${row.feeBalance} - ${amount})`, amountPaid: sql`${row.amountPaid ?? "0"} + ${amount}`, updatedAt: new Date() }).where(eq(students.id, studentId)).returning())[0];
  return updated ? studentRow(updated) : undefined;
}
export async function listPayments() {
  const schoolId = await getSchoolId();
  const rows = await db.select({ payment: payments, student: students }).from(payments).innerJoin(students, eq(payments.studentId, students.id)).where(eq(payments.schoolId, schoolId)).orderBy(desc(payments.createdAt));
  return rows.map(({ payment, student }) => ({ id: payment.id, studentId: student.id, receiptNumber: payment.receiptNumber, studentName: `${student.firstName}${student.middleName ? ` ${student.middleName}` : ""} ${student.lastName}`, registrationNumber: student.registrationNumber, amount: number(payment.amount), method: payment.method, date: new Date(`${payment.paidOn}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), status: payment.status as Payment["status"], balance: number(student.feeBalance) }));
}
export async function recordPayment(studentId: string, amount: number, method: string, reference: string) {
  if (amount <= 0) throw new Error("Payment amount must be positive");
  const schoolId = await getSchoolId();
  return db.transaction(async (tx) => {
    const lockedStudentRow = (await tx.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.id, studentId))).for("update").limit(1))[0];
    if (!lockedStudentRow) return undefined;
    const student = studentRow(lockedStudentRow);
    if (amount > student.feeBalance) throw new Error("Payment cannot exceed the pupil fee balance");
    const year = new Date().getFullYear();
    const count = await tx.select({ count: sql<number>`count(*)` }).from(payments).where(and(eq(payments.schoolId, schoolId), ilike(payments.receiptNumber, `RCPT-${year}-%`)));
    const receiptSequence = (await tx.insert(recordSequences).values({
      schoolId, year, kind: "receipt", value: Number(count[0]?.count ?? 0) + 1,
    }).onConflictDoUpdate({
      target: [recordSequences.schoolId, recordSequences.year, recordSequences.kind],
      set: { value: sql`${recordSequences.value} + 1`, updatedAt: new Date() },
    }).returning({ value: recordSequences.value }))[0];
    if (!receiptSequence) throw new Error("Unable to allocate receipt number");
    const receiptNumber = `RCPT-${year}-${String(receiptSequence.value).padStart(4, "0")}`;
    const row = (await tx.insert(payments).values({ schoolId, studentId: student.id, receiptNumber, amount: String(amount), method, reference, paidOn: isoDate(), status: "completed" }).returning())[0];
    await tx.update(students).set({ feeBalance: sql`fee_balance - ${amount}`, amountPaid: sql`coalesce(amount_paid, 0) + ${amount}`, updatedAt: new Date() }).where(and(eq(students.schoolId, schoolId), eq(students.id, student.id)));
    const updatedStudent = (await tx.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.id, student.id))).limit(1))[0];
    return row ? { id: row.id, studentId: student.id, receiptNumber, studentName: student.name, registrationNumber: student.registrationNumber, amount, method, date: getDateLabel(), status: "completed" as const, balance: number(updatedStudent?.feeBalance) } : undefined;
  });
}

export async function listSalaryPayments() {
  const [rows, usersRows] = await Promise.all([listOperation("salaryPayments"), listUsers()]);
  const totals = new Map<string, number>();
  rows.forEach((item) => {
    const key = `${String(item.staffId || "")}::${String(item.period || "")}`;
    totals.set(key, (totals.get(key) || 0) + number(item.amount as number | string | undefined));
  });
  return rows.map((item) => {
    const staffId = String(item.staffId || "");
    const staff = usersRows.find((user) => user.id === staffId);
    const monthlySalary = staff?.monthlySalary ?? number(item.monthlySalary as number | string | undefined);
    const period = String(item.period || "");
    return {
      id: item.id,
      staffId,
      staffName: String(item.staffName || staff?.name || "Unknown staff member"),
      monthlySalary,
      period,
      amount: number(item.amount as number | string | undefined),
      balance: Math.max(0, monthlySalary - (totals.get(`${staffId}::${period}`) || 0)),
      receiptNumber: String(item.receiptNumber || ""),
      paymentDate: String(item.paymentDate || ""),
      method: String(item.method || ""),
      reference: String(item.reference || ""),
      status: String(item.status || "Paid"),
    };
  });
}

export async function listSalaryStaff() {
  return (await listUsers())
    .filter((user) => user.role === "teacher" || user.role === "staff")
    .map((user) => ({ id: user.id, name: user.name, role: user.role, monthlySalary: user.monthlySalary || 0 }));
}

export async function recordSalaryPayment(data: { staffId: string; period: string; amount: number; method: string; reference: string }) {
  if (data.amount <= 0) throw new Error("Salary payment must be positive");
  const schoolId = await getSchoolId();
  const staffUser = (await db.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.id, data.staffId))).limit(1))[0];
  if (!staffUser || !["teacher", "staff"].includes(staffUser.role)) throw new Error("Choose a registered teacher or staff member.");
  const monthlySalary = number(staffUser.monthlySalary);
  if (monthlySalary <= 0) throw new Error("Register a monthly salary for this staff member before paying them.");
  const existing = await listOperation("salaryPayments");
  const paidForPeriod = existing.filter((item) => String(item.staffId || "") === data.staffId && String(item.period || "") === data.period).reduce((sum, item) => sum + number(item.amount as number | string | undefined), 0);
  const balance = Math.max(0, monthlySalary - paidForPeriod);
  if (data.amount > balance) throw new Error(`Payment exceeds the ${data.period} salary balance of ${balance}.`);
  const year = new Date().getFullYear();
  const sequence = (await db.insert(recordSequences).values({ schoolId, year, kind: "salary_receipt", value: 1 }).onConflictDoUpdate({
    target: [recordSequences.schoolId, recordSequences.year, recordSequences.kind],
    set: { value: sql`${recordSequences.value} + 1`, updatedAt: new Date() },
  }).returning({ value: recordSequences.value }))[0];
  if (!sequence) throw new Error("Unable to allocate salary receipt number");
  const receiptNumber = `SAL-${year}-${String(sequence.value).padStart(4, "0")}`;
  const row = (await db.insert(salaryPayments).values({
    schoolId,
    data: { staffId: staffUser.id, staffName: staffUser.name, monthlySalary, period: data.period, amount: data.amount, receiptNumber, paymentDate: getDateLabel(), method: data.method, reference: data.reference, status: "Paid" },
  }).returning())[0];
  if (!row) throw new Error("Unable to record salary payment");
  return (await listSalaryPayments()).find((item) => item.id === row.id);
}

const tables = { announcements, assignments, classes, discipline, documents, events, expenses, inventory, library, medical, notifications, parents, reports, salaryPayments, staff, subjects, timetable, transport } as const;
export type OperationKind = keyof typeof tables;
export async function listOperation(kind: OperationKind): Promise<OperationRecord[]> {
  const schoolId = await getSchoolId();
  const table = tables[kind];
  const rows = await db.select().from(table).where(eq(table.schoolId, schoolId)).orderBy(desc(table.createdAt));
  return rows.map((row) => ({ ...(row.data as OperationRecord), id: row.id }));
}
export async function createClass(data: { name: string; grade: string; stream: string; room: string; teacherId?: string | null }) {
  const name = data.name.trim();
  const grade = data.grade.trim();
  const stream = data.stream.trim();
  const room = data.room.trim();
  if (!name || !grade || !stream || !room) throw new Error("Complete the class name, grade, stream, and room.");
  const existing = await listOperation("classes");
  if (existing.some((item) => classAssignmentKey(String(item.name), String(item.stream ?? "")).toLowerCase() === classAssignmentKey(name, stream).toLowerCase())) {
    throw new Error("A class with that name and stream already exists.");
  }
  const teacher = data.teacherId ? await findUserById(data.teacherId) : undefined;
  if (data.teacherId && (!teacher || teacher.role !== "teacher")) throw new Error("Choose a registered teacher to assign to this class.");
  const pupils = await listStudents();
  const row = await createOperation("classes", {
    name,
    grade,
    stream,
    room,
    teacherId: teacher?.id ?? null,
    teacherName: teacher?.name ?? "Unassigned",
    pupilCount: pupils.filter((pupil) => pupil.className === name).length,
    subjectCount: 0,
  });
  if (!row) throw new Error("The class could not be created.");
  return row;
}
export async function createOperation(kind: OperationKind, data: Record<string, unknown>) {
  const schoolId = await getSchoolId();
  const table = tables[kind];
  const row = (await db.insert(table).values({ schoolId, data } as never).returning())[0];
  return row ? { ...(row.data as OperationRecord), id: row.id } : undefined;
}
export async function updateOperation(kind: OperationKind, id: string, data: Record<string, unknown>) {
  const schoolId = await getSchoolId();
  const table = tables[kind];
  const row = (await db.update(table).set({ data, updatedAt: new Date() } as never).where(and(eq(table.schoolId, schoolId), eq(table.id, id))).returning())[0];
  return row ? { ...(row.data as OperationRecord), id: row.id } : undefined;
}
export async function deleteOperation(kind: OperationKind, id: string) {
  const schoolId = await getSchoolId();
  const table = tables[kind];
  const row = (await db.delete(table).where(and(eq(table.schoolId, schoolId), eq(table.id, id))).returning({ id: table.id }))[0];
  return !!row;
}
export async function saveAttendance(studentId: string, date: string, status: AttendanceStatus, arrivalTime?: string | null) {
  const student = await getStudent(studentId);
  if (!student) return undefined;
  const schoolId = await getSchoolId();
  const row = (await db.insert(attendance).values({ schoolId, studentId: student.id, date, status, arrivalTime: arrivalTime || null }).onConflictDoUpdate({ target: [attendance.studentId, attendance.date], set: { status, arrivalTime: arrivalTime || null, updatedAt: new Date() } }).returning())[0];
  return row ? { id: row.id, studentId: student.id, studentName: student.name, registrationNumber: student.registrationNumber, className: `${student.className} ${student.stream}`, date: row.date, status: row.status as AttendanceStatus, arrivalTime: row.arrivalTime } : undefined;
}
export async function listAttendance() {
  const schoolId = await getSchoolId();
  const rows = await db.select({ record: attendance, student: students }).from(attendance).innerJoin(students, eq(attendance.studentId, students.id)).where(eq(attendance.schoolId, schoolId)).orderBy(desc(attendance.date));
  return rows.map(({ record, student }) => ({ id: record.id, studentId: student.id, studentName: `${student.firstName}${student.middleName ? ` ${student.middleName}` : ""} ${student.lastName}`, registrationNumber: student.registrationNumber, className: `${student.className} ${student.stream}`, date: record.date, status: record.status as AttendanceStatus, arrivalTime: record.arrivalTime }));
}

export async function createAttendanceRegister(className: string, date: string) {
  const schoolId = await getSchoolId();
  const classRow = (await listOperation("classes")).find((item) => classAssignmentKey(String(item.name), String(item.stream ?? "")) === className);
  const classFilter = classRow ? [String(classRow.name), String(classRow.stream ?? "")] : [className, ""];
  const classStudents = (await db.select().from(students).where(and(
    eq(students.schoolId, schoolId),
    eq(students.className, classFilter[0]),
    ...(classFilter[1] ? [eq(students.stream, classFilter[1])] : []),
    eq(students.status, "active"),
  ))).map(studentRow);
  const created = await Promise.all(classStudents.map(async (student) => {
    const row = (await db.insert(attendance).values({
      schoolId, studentId: student.id, date, status: "present", arrivalTime: null,
    }).onConflictDoNothing({ target: [attendance.studentId, attendance.date] }).returning())[0];
    return row ? { id: row.id, studentId: student.id, studentName: student.name, registrationNumber: student.registrationNumber, className: `${student.className} ${student.stream}`, date: row.date, status: row.status as AttendanceStatus, arrivalTime: row.arrivalTime } : undefined;
  }));
  return created.filter((item): item is NonNullable<typeof item> => !!item);
}
