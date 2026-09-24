import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  announcements, attendance, assignments, classes, discipline, documents, events, expenses,
  inventory, library, loginAttempts, medical, notifications, parents, payments, payrollPayments, reports, salaryPayments, schoolSettings,
  recordSequences, sessions, staff, students, subjects, timetable, transport, users,
} from "@workspace/db";
import type { SchoolSettings, User } from "@workspace/db";
import { requestObjectDownload } from "./object-storage";
import { compactSingleSegmentSms } from "./single-segment-sms";

export type SchoolRole = "super_admin" | "administrator" | "teacher" | "accountant" | "secretary" | "librarian" | "nurse" | "guardian" | "student" | "staff";
export type PermissionKey = "expense_approve" | "expense_delete" | "transactions_view" | "transactions_print" | "finance_view" | "payments_manage" | "expenses_view" | "users_view" | "users_manage" | "subjects_view" | "subjects_manage" | "subjects_delete";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type SchoolUser = {
  id: string; name: string; identifier: string; email: string; phone: string; password: string; userType: "staff" | "guardian" | "learner";
  role: SchoolRole; status: "active" | "inactive"; department?: string; permissions: PermissionKey[]; initials: string; schoolName: string; studentId?: string; assignedClasses?: string[]; monthlySalary?: number;
};
export type SchoolStudent = {
  id: string; registrationNumber: string; name: string; firstName: string; lastName: string; middleName?: string;
  className: string; stream: string; gender: string; status: "active" | "inactive"; attendancePercentage: number;
  feeBalance: number; previousFeeBalance: number; avatarTone: string; dateOfBirth: string; guardianName: string; guardianPhone: string;
  guardianEmail: string; admissionDate: string; enrollmentType?: "day" | "boarding"; isSponsored: boolean; termFee?: number; amountPaid?: number; photoPath?: string;
};
export type AttendanceRecord = { id: string; studentId: string; studentName: string; registrationNumber: string; className: string; date: string; status: AttendanceStatus; arrivalTime?: string | null };
export type DeletedAttendanceRegister = { date: string; className: string; recordCount: number; reason: string; deletedAt: string; deletedBy?: string | null };
export type Payment = { id: string; studentId: string; receiptNumber: string; studentName: string; registrationNumber: string; amount: number; method: string; reference: string; date: string; status: "completed" | "pending" | "reversed"; balance: number };
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
const validPaymentPrecision = (value: number) => Number.isFinite(value) && Math.abs(value - Math.round(value * 100) / 100) < 1e-9;
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
    const production = process.env["NODE_ENV"] === "production";
    const configuredPassword = process.env["SCHOOL_BOOTSTRAP_PASSWORD"];
    const canonicalAdmins = await db.select().from(users).where(and(eq(users.schoolId, setting.id), ilike(users.identifier, "Isingoma"), eq(users.userType, "staff"))).limit(1);
    const legacyAdmins = await db.select().from(users).where(and(eq(users.schoolId, setting.id), ilike(users.identifier, "admin"), eq(users.userType, "staff"))).limit(1);
    const bootstrapAdmin = canonicalAdmins[0] || legacyAdmins[0];
    if (production && !configuredPassword && (!bootstrapAdmin || verifyPassword("admin123", bootstrapAdmin.passwordHash))) {
      throw new Error("SCHOOL_BOOTSTRAP_PASSWORD must be configured before the first production start");
    }
    if (canonicalAdmins[0]) {
      if (legacyAdmins[0]) {
        await db.delete(users).where(eq(users.id, legacyAdmins[0].id));
      }
      await db.update(users).set({
        name: "Isingoma",
        identifier: "Isingoma",
        ...(configuredPassword && verifyPassword("admin123", canonicalAdmins[0].passwordHash) ? { passwordHash: hashPassword(configuredPassword) } : {}),
        role: "administrator",
        status: "active",
        initials: "SA",
        updatedAt: new Date(),
      }).where(eq(users.id, canonicalAdmins[0].id));
    } else if (legacyAdmins[0]) {
      const legacyPassword = production && configuredPassword && verifyPassword("admin123", legacyAdmins[0].passwordHash)
        ? hashPassword(configuredPassword)
        : legacyAdmins[0].passwordHash;
      await db.update(users).set({
        name: "Isingoma",
        identifier: "Isingoma",
        passwordHash: legacyPassword,
        updatedAt: new Date(),
      }).where(eq(users.id, legacyAdmins[0].id));
    } else {
      await db.insert(users).values({
        schoolId: setting.id,
        name: "Isingoma",
        identifier: "Isingoma",
        passwordHash: hashPassword(configuredPassword || "admin123"),
        userType: "staff", role: "administrator", status: "active", initials: "SA",
      }).onConflictDoNothing({ target: [users.schoolId, users.identifier] });
    }
    const syncConfiguredStaffAccount = async (identifier: string, role: SchoolRole, initialsValue: string, password: string | undefined) => {
      if (!password) return;
      const existing = (await db.select().from(users).where(and(
        eq(users.schoolId, setting.id),
        ilike(users.identifier, identifier),
        eq(users.userType, "staff"),
      )).limit(1))[0];
      if (existing) {
        await db.update(users).set({
          identifier,
          role,
          status: "active",
          initials: initialsValue,
          updatedAt: new Date(),
        }).where(eq(users.id, existing.id));
      } else {
        await db.insert(users).values({
          schoolId: setting.id,
          name: identifier,
          identifier,
          passwordHash: hashPassword(password),
          userType: "staff",
          role,
          status: "active",
          initials: initialsValue,
        });
      }
    };
    await syncConfiguredStaffAccount("Rogers", "accountant", "RO", process.env["SCHOOL_ACCOUNTANT_PASSWORD"]);
    await syncConfiguredStaffAccount("Phiona", "teacher", "PH", process.env["SCHOOL_TEACHER_PASSWORD"]);
    const secretaryPassword = process.env["SCHOOL_SECRETARY_PASSWORD"];
    if (secretaryPassword) {
      const secretary = (await db.select().from(users).where(and(
        eq(users.schoolId, setting.id),
        ilike(users.identifier, "Asobora"),
        eq(users.userType, "staff"),
      )).limit(1))[0];
      if (secretary) {
        await db.update(users).set({
          name: "Asobora",
          identifier: "Asobora",
          role: "secretary",
          status: "active",
          initials: "AS",
          updatedAt: new Date(),
        }).where(eq(users.id, secretary.id));
      } else {
        await db.insert(users).values({
          schoolId: setting.id,
          name: "Asobora",
          identifier: "Asobora",
          passwordHash: hashPassword(secretaryPassword),
          userType: "staff",
          role: "secretary",
          status: "active",
          initials: "AS",
        });
      }
    }
    return setting.id;
  })();
  try { return await bootstrapPromise; } catch (error) { bootstrapPromise = undefined; throw error; }
}
export async function getSchoolId() { return initializeSchoolData(); }

function publicRow(row: User, setting: SchoolSettings): SchoolUser {
  const permissions = Array.isArray(row.permissions) ? row.permissions.filter((item): item is PermissionKey => ["expense_approve", "expense_delete", "transactions_view", "transactions_print", "finance_view", "payments_manage", "expenses_view", "users_view", "users_manage", "subjects_view", "subjects_manage", "subjects_delete"].includes(item)) : [];
  return { id: row.id, name: row.name, identifier: row.identifier, email: row.email, phone: row.phone, password: row.passwordHash, userType: row.userType as SchoolUser["userType"], role: row.role as SchoolRole, status: (row.status || "active") as SchoolUser["status"], ...(row.department ? { department: row.department } : {}), permissions, initials: row.initials, schoolName: setting.schoolName, ...(row.studentId ? { studentId: row.studentId } : {}), ...(row.monthlySalary !== null ? { monthlySalary: number(row.monthlySalary) } : {}) };
}
export function publicUser(user: SchoolUser) {
  return { id: user.id, name: user.name, identifier: user.identifier, email: user.email, phone: user.phone, role: user.role, status: user.status, ...(user.department ? { department: user.department } : {}), permissions: user.permissions, initials: user.initials, schoolName: user.schoolName, studentId: user.studentId ?? null, ...(user.assignedClasses ? { assignedClasses: user.assignedClasses } : {}), ...(user.monthlySalary !== undefined ? { monthlySalary: user.monthlySalary } : {}) };
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
export async function findUser(identifier: string, _userType?: string) {
  const schoolId = await getSchoolId();
  const normalizedIdentifier = identifier.trim();
  const rows = await db.select().from(users).where(and(eq(users.schoolId, schoolId), ilike(users.identifier, normalizedIdentifier))).limit(1);
  const setting = await getSchoolSettings();
  return rows[0] ? publicRow(rows[0], setting) : undefined;
}
export async function findUserById(id: string) {
  const schoolId = await getSchoolId();
  const rows = await db.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.id, id))).limit(1);
  const setting = await getSchoolSettings();
  return rows[0] ? publicRow(rows[0], setting) : undefined;
}
export async function updateUserProfile(user: SchoolUser, data: {
  name?: string; identifier?: string; email?: string; phone?: string; newPassword?: string;
}) {
  const schoolId = await getSchoolId();
  const updates: Partial<User> = { updatedAt: new Date() };
  const isCanonicalAdministrator = user.role === "administrator" && user.identifier.trim().toLowerCase() === "isingoma";
  if (data.name !== undefined && !isCanonicalAdministrator) {
    updates.name = data.name.trim();
    updates.initials = initials(data.name);
  }
  if (data.identifier !== undefined && !isCanonicalAdministrator) updates.identifier = data.identifier.trim();
  if (data.email !== undefined) updates.email = data.email.trim();
  if (data.phone !== undefined) updates.phone = data.phone.trim();
  if (data.newPassword !== undefined) updates.passwordHash = hashPassword(data.newPassword);
  const row = (await db.update(users).set(updates).where(and(eq(users.schoolId, schoolId), eq(users.id, user.id))).returning())[0];
  if (!row) throw new Error("Account not found");
  if (user.userType === "staff") {
    const staffRecord = (await listOperation("staff")).find((item) => String(item.userId || "") === user.id);
    if (staffRecord) {
      await updateOperation("staff", staffRecord.id, {
        ...staffRecord,
        name: row.name,
        username: row.identifier,
        email: row.email,
        phone: row.phone,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return publicRow(row, await getSchoolSettings());
}

export async function createUser(data: {
  name: string;
  identifier: string;
  password: string;
  role: SchoolRole;
  userType: "staff" | "learner";
  studentId?: string | null;
  email?: string;
  phone?: string;
  monthlySalary?: number | null;
  department?: string;
  permissions?: PermissionKey[];
}) {
  const schoolId = await getSchoolId();
  const setting = await getSchoolSettings();
  const identifier = data.identifier.trim();
  const existing = await db.select({ id: users.id }).from(users).where(and(eq(users.schoolId, schoolId), ilike(users.identifier, identifier))).limit(1);
  if (existing[0]) throw new Error("That username or registration number is already in use.");
  const linkedStudent = data.studentId ? await getStudent(data.studentId) : undefined;
  if ((data.role === "student" || data.role === "guardian") && !linkedStudent) throw new Error("Link pupil and guardian accounts to a student record.");
  if (data.studentId && !linkedStudent) throw new Error("The linked pupil record was not found.");
  const row = (await db.insert(users).values({
    schoolId,
    name: data.name.trim(),
    identifier,
    email: data.email?.trim() || "",
    phone: data.phone?.trim() || "",
    passwordHash: hashPassword(data.password),
    userType: data.userType,
    role: data.role,
    status: "active",
    permissions: data.permissions || [],
    initials: initials(data.name),
    studentId: linkedStudent?.id || null,
    monthlySalary: data.monthlySalary == null ? null : String(data.monthlySalary),
    department: data.department?.trim() || null,
  }).returning())[0];
  if (!row) throw new Error("The account could not be created.");
  return publicRow(row, setting);
}

export async function updateUserAdmin(id: string, data: {
  name?: string; identifier?: string; email?: string; phone?: string; newPassword?: string;
  role?: SchoolRole; status?: "active" | "inactive"; permissions?: PermissionKey[];
  studentId?: string | null; monthlySalary?: number | null; department?: string;
}) {
  const schoolId = await getSchoolId();
  const current = (await db.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.id, id))).limit(1))[0];
  if (!current) return undefined;
  const updates: Partial<User> = { updatedAt: new Date() };
  if (data.name !== undefined) { updates.name = data.name.trim(); updates.initials = initials(data.name); }
  if (data.identifier !== undefined) updates.identifier = data.identifier.trim();
  if (data.email !== undefined) updates.email = data.email.trim();
  if (data.phone !== undefined) updates.phone = data.phone.trim();
  if (data.newPassword !== undefined) updates.passwordHash = hashPassword(data.newPassword);
  if (data.role !== undefined) updates.role = data.role;
  if (data.status !== undefined) updates.status = data.status;
  if (data.permissions !== undefined) updates.permissions = data.permissions;
  if (data.studentId !== undefined) {
    const linkedStudent = data.studentId ? await getStudent(data.studentId) : undefined;
    if (data.studentId && !linkedStudent) throw new Error("The linked pupil record was not found.");
    updates.studentId = linkedStudent?.id || null;
  }
  if (data.monthlySalary !== undefined) updates.monthlySalary = data.monthlySalary == null ? null : String(data.monthlySalary);
  if (data.department !== undefined) updates.department = data.department.trim() || null;
  const row = (await db.update(users).set(updates).where(and(eq(users.schoolId, schoolId), eq(users.id, id))).returning())[0];
  if (!row) return undefined;
  const staffRecord = (await listOperation("staff")).find((item) => String(item.userId || "") === id);
  if (row.userType === "staff" && staffRecord) {
    const staffData = { ...(staffRecord || {}), userId: row.id, name: row.name, role: row.role.replace("_", " "), username: row.identifier, phone: row.phone || "Not provided", status: row.status === "active" ? "Active" : "Inactive", updatedAt: new Date().toISOString() };
    await updateOperation("staff", staffRecord.id, staffData);
  }
  return publicRow(row, await getSchoolSettings());
}

export async function deleteUser(id: string) {
  const schoolId = await getSchoolId();
  const row = (await db.delete(users).where(and(eq(users.schoolId, schoolId), eq(users.id, id))).returning({ id: users.id }))[0];
  if (!row) return false;
  return true;
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
  const user = row ? await findUserById(row.userId) : undefined;
  return user?.status === "active" ? user : undefined;
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
    status: row.status as SchoolStudent["status"], attendancePercentage: row.attendancePercentage, feeBalance: number(row.feeBalance), previousFeeBalance: number(row.previousFeeBalance),
    avatarTone: row.avatarTone, dateOfBirth: row.dateOfBirth, guardianName: row.guardianName, guardianPhone: row.guardianPhone,
    guardianEmail: row.guardianEmail, admissionDate: row.admissionDate, isSponsored: row.isSponsored,
  };
  if (row.middleName) result.middleName = row.middleName;
  if (row.photoPath) result.photoPath = row.photoPath;
  result.enrollmentType = (row.enrollmentType || "day") as "day" | "boarding";
  result.termFee = number(row.termFee);
  result.amountPaid = number(row.amountPaid);
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
  enrollmentType?: "day" | "boarding"; isSponsored?: boolean; termFee?: number; previousFeeBalance?: number; status?: "active" | "inactive"; newPassword?: string;
  religion?: string; placeOfBirth?: string; homeVillage?: string; nationality?: string; tribe?: string;
  guardianRelationship?: string; guardianNationalId?: string; residentialAddress?: string; guardianOccupation?: string;
   motherName?: string; motherStatus?: "alive" | "deceased"; motherPhone?: string; motherAlternativePhone?: string; motherEmail?: string;
   motherOccupation?: string; motherNationalId?: string; motherAddress?: string;
   fatherName?: string; fatherStatus?: "alive" | "deceased"; fatherPhone?: string; fatherAlternativePhone?: string; fatherEmail?: string;
   fatherOccupation?: string; fatherNationalId?: string; fatherAddress?: string;
  alternativeContact?: string; previousSchool?: string; lastClassCompleted?: string; medicalConditions?: string;
  specialNeeds?: string; knownMedicalNote?: string; emergencyContactName?: string; emergencyContactPhone?: string;
  emergencyContactRelationship?: string; declarationAccepted?: boolean; declarationDate?: string; photoPath?: string | null;
}) {
  const schoolId = await getSchoolId();
  const current = (await db.select().from(students).where(and(eq(students.schoolId, schoolId), eq(students.id, id))).limit(1))[0];
  if (!current) return undefined;
  const updates: Partial<typeof students.$inferInsert> = { updatedAt: new Date() };
  for (const key of ["firstName", "middleName", "lastName", "dateOfBirth", "gender", "className", "stream", "guardianName", "guardianPhone", "guardianEmail", "enrollmentType", "status"] as const) {
    if (data[key] !== undefined) {
      const value = typeof data[key] === "string" ? data[key].trim() : data[key];
      updates[key] = (key === "middleName" && value === "" ? null : value) as never;
    }
  }
  if (data.isSponsored !== undefined) updates.isSponsored = data.isSponsored;
  if (data.termFee !== undefined) updates.termFee = String(data.isSponsored === true ? 0 : data.termFee);
  if (data.previousFeeBalance !== undefined) updates.previousFeeBalance = String(data.isSponsored === true ? 0 : data.previousFeeBalance);
  if (data.photoPath !== undefined) {
    updates.photoPath = data.photoPath?.trim() || null;
  }
  if (data.isSponsored === true) {
    updates.termFee = "0";
    updates.previousFeeBalance = "0";
    updates.feeBalance = "0";
  } else if (data.termFee !== undefined || data.previousFeeBalance !== undefined || data.isSponsored === false) {
    const termFee = data.termFee ?? number(current.termFee);
    const previousFeeBalance = data.previousFeeBalance ?? number(current.previousFeeBalance);
    updates.feeBalance = String(Math.max(0, previousFeeBalance + termFee - number(current.amountPaid)));
  }
  const updated = (await db.update(students).set(updates).where(and(eq(students.schoolId, schoolId), eq(students.id, id))).returning())[0];
  if (!updated) return undefined;
  const classRows = await listOperation("classes");
  if (classRows.length) {
    const pupils = await listStudents();
    await Promise.all(classRows.map((item) => updateOperation("classes", item.id, {
      ...item,
      pupilCount: pupils.filter((pupil) => pupil.className === String(item.name)).length,
    })));
  }
  const admission = (await db.select().from(documents).where(and(eq(documents.schoolId, schoolId), sql`${documents.data}->>'studentId' = ${id}`, sql`${documents.data}->>'documentType' = 'admission_form'`)).orderBy(desc(documents.createdAt)).limit(1))[0];
  if (admission) {
    const currentForm = admission.data as Record<string, unknown>;
    const admissionFields = [
      "guardianEmail", "religion", "placeOfBirth", "homeVillage", "nationality", "tribe",
      "guardianRelationship", "guardianNationalId", "residentialAddress", "guardianOccupation",
      "motherName", "motherStatus", "motherPhone", "motherAlternativePhone", "motherEmail", "motherOccupation", "motherNationalId", "motherAddress",
      "fatherName", "fatherStatus", "fatherPhone", "fatherAlternativePhone", "fatherEmail", "fatherOccupation", "fatherNationalId", "fatherAddress",
      "alternativeContact", "previousSchool", "lastClassCompleted", "medicalConditions", "specialNeeds",
      "knownMedicalNote", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship",
      "declarationAccepted", "declarationDate",
    ] as const;
    for (const key of admissionFields) {
      if (data[key] !== undefined) currentForm[key] = data[key];
    }
    await db.update(documents).set({
      data: {
        ...currentForm,
        pupilName: `${updated.firstName}${updated.middleName ? ` ${updated.middleName}` : ""} ${updated.lastName}`,
        dateOfBirth: updated.dateOfBirth,
        gender: updated.gender,
        className: updated.className,
        stream: updated.stream,
        isSponsored: updated.isSponsored,
        termFee: number(updated.termFee),
        amountPaid: number(updated.amountPaid),
        previousFeeBalance: number(updated.previousFeeBalance),
        feeBalance: number(updated.feeBalance),
        guardianName: updated.guardianName,
        guardianPhone: updated.guardianPhone,
        guardianEmail: updated.guardianEmail,
        enrollmentType: updated.enrollmentType,
        photoPath: updated.photoPath || undefined,
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
  if (row) {
    const saved = row.data as Record<string, unknown>;
    return {
      ...saved,
      id: row.id,
      isSponsored: saved.isSponsored ?? student.isSponsored,
      previousFeeBalance: saved.previousFeeBalance === undefined ? student.previousFeeBalance : saved.previousFeeBalance,
      feeBalance: saved.feeBalance === undefined ? student.feeBalance : saved.feeBalance,
      // The pupil profile is the source of truth. This keeps already-saved
      // admission documents current when the profile photo is replaced later.
      photoPath: student.photoPath ?? saved.photoPath,
    };
  }
  return {
    id: `generated-admission-${student.id}`,
    studentId: student.id,
    registrationNumber: student.registrationNumber,
    pupilName: student.name,
    dateOfBirth: student.dateOfBirth,
    gender: student.gender,
    className: student.className,
    stream: student.stream,
    guardianName: student.guardianName,
    guardianPhone: student.guardianPhone,
    admissionDate: student.admissionDate,
    enrollmentType: student.enrollmentType || "day",
    isSponsored: student.isSponsored,
    termFee: student.termFee || 0,
    amountPaid: student.amountPaid || 0,
    previousFeeBalance: student.previousFeeBalance,
    feeBalance: student.feeBalance,
    photoPath: student.photoPath,
    generatedAt: new Date().toISOString(),
  };
}
export async function createStudentWithPayment(data: {
  firstName: string; middleName?: string; lastName: string; className?: string; stream?: string; gender?: string; dateOfBirth?: string;
  guardianName: string; guardianPhone: string; guardianEmail?: string; enrollmentType?: "day" | "boarding"; isSponsored?: boolean; termFee: number;
  photoPath?: string;
  religion?: string; placeOfBirth?: string; homeVillage?: string; nationality?: string; tribe?: string;
  guardianRelationship?: string; guardianNationalId?: string; residentialAddress?: string; guardianOccupation?: string;
   motherName?: string; motherStatus?: "alive" | "deceased"; motherPhone?: string; motherAlternativePhone?: string; motherEmail?: string;
   motherOccupation?: string; motherNationalId?: string; motherAddress?: string;
   fatherName?: string; fatherStatus?: "alive" | "deceased"; fatherPhone?: string; fatherAlternativePhone?: string; fatherEmail?: string;
   fatherOccupation?: string; fatherNationalId?: string; fatherAddress?: string;
  alternativeContact?: string; previousSchool?: string; lastClassCompleted?: string; medicalConditions?: string;
  specialNeeds?: string; knownMedicalNote?: string; emergencyContactName?: string; emergencyContactPhone?: string;
  emergencyContactRelationship?: string; declarationAccepted?: boolean; declarationDate?: string;
  initialPayment?: number; previousFeeBalance?: number; paymentMethod?: string; paymentReference?: string;
}) {
  const schoolId = await getSchoolId();
  return db.transaction(async (tx) => {
    const text = (value?: string) => value?.trim() || "";
    const firstName = data.firstName.trim();
    const middleName = text(data.middleName) || undefined;
    const lastName = data.lastName.trim();
    const className = text(data.className) || "Unassigned";
    const stream = text(data.stream);
    const gender = text(data.gender) || "Not specified";
    const dateOfBirth = text(data.dateOfBirth) || isoDate();
    const guardianName = data.guardianName.trim();
    const guardianPhone = data.guardianPhone.trim();
    const guardianEmail = text(data.guardianEmail);
    const photoPath = text(data.photoPath) || undefined;
    const enrollmentType = data.enrollmentType || "day";
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
    const isSponsored = data.isSponsored === true;
    const termFee = isSponsored ? 0 : data.termFee;
    const initialPayment = isSponsored ? 0 : (data.initialPayment ?? 0);
    const previousFeeBalance = isSponsored ? 0 : (data.previousFeeBalance ?? 0);
    if (initialPayment < 0 || initialPayment > termFee) throw new Error("Opening payment cannot exceed the term fee");
    if (previousFeeBalance < 0) throw new Error("Previous fee balance cannot be negative");
    const studentRowValue = (await tx.insert(students).values({
       schoolId, registrationNumber, firstName, middleName, lastName,
       className, stream, gender, dateOfBirth,
        guardianName, guardianPhone, guardianEmail, admissionDate: isoDate(), enrollmentType, photoPath,
       isSponsored, termFee: String(termFee), amountPaid: String(initialPayment), previousFeeBalance: String(previousFeeBalance), feeBalance: String(Math.max(0, previousFeeBalance + termFee - initialPayment)),
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
       payment = paymentRow ? { id: paymentRow.id, studentId: studentRowValue.id, receiptNumber, studentName: `${firstName}${middleName ? ` ${middleName}` : ""} ${lastName}`, registrationNumber, amount: initialPayment, method: paymentRow.method, reference: paymentRow.reference, date: getDateLabel(), status: "completed", balance: Math.max(0, previousFeeBalance + termFee - initialPayment) } : undefined;
    }
    const admissionFormData = {
      documentType: "admission_form",
      title: "Pupil Admission Form",
      studentId: studentRowValue.id,
      registrationNumber,
       pupilName: `${firstName}${middleName ? ` ${middleName}` : ""} ${lastName}`,
       dateOfBirth,
       gender,
       className,
       stream,
       guardianName,
       guardianPhone,
       guardianEmail,
       religion: text(data.religion),
       placeOfBirth: text(data.placeOfBirth),
       homeVillage: text(data.homeVillage),
       nationality: text(data.nationality),
       tribe: text(data.tribe),
       guardianRelationship: text(data.guardianRelationship),
       guardianNationalId: text(data.guardianNationalId),
       residentialAddress: text(data.residentialAddress),
       guardianOccupation: text(data.guardianOccupation),
       alternativeContact: text(data.alternativeContact),
       motherName: text(data.motherName),
        motherStatus: data.motherStatus === "deceased" ? "deceased" : data.motherStatus === "alive" ? "alive" : undefined,
       motherPhone: text(data.motherPhone),
       motherAlternativePhone: text(data.motherAlternativePhone),
       motherEmail: text(data.motherEmail),
       motherOccupation: text(data.motherOccupation),
       motherNationalId: text(data.motherNationalId),
       motherAddress: text(data.motherAddress),
       fatherName: text(data.fatherName),
        fatherStatus: data.fatherStatus === "deceased" ? "deceased" : data.fatherStatus === "alive" ? "alive" : undefined,
       fatherPhone: text(data.fatherPhone),
       fatherAlternativePhone: text(data.fatherAlternativePhone),
       fatherEmail: text(data.fatherEmail),
       fatherOccupation: text(data.fatherOccupation),
       fatherNationalId: text(data.fatherNationalId),
       fatherAddress: text(data.fatherAddress),
       previousSchool: text(data.previousSchool),
       lastClassCompleted: text(data.lastClassCompleted),
       medicalConditions: text(data.medicalConditions),
       specialNeeds: text(data.specialNeeds),
       knownMedicalNote: text(data.knownMedicalNote),
       emergencyContactName: text(data.emergencyContactName),
       emergencyContactPhone: text(data.emergencyContactPhone),
       emergencyContactRelationship: text(data.emergencyContactRelationship),
       declarationAccepted: data.declarationAccepted === true,
       declarationDate: text(data.declarationDate) || isoDate(),
      admissionDate: studentRowValue.admissionDate,
        enrollmentType,
       isSponsored,
       termFee,
      amountPaid: initialPayment,
      previousFeeBalance,
       feeBalance: Math.max(0, previousFeeBalance + termFee - initialPayment),
       photoPath,
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
  return rows.map(({ payment, student }) => ({ id: payment.id, studentId: student.id, receiptNumber: payment.receiptNumber, studentName: `${student.firstName}${student.middleName ? ` ${student.middleName}` : ""} ${student.lastName}`, registrationNumber: student.registrationNumber, amount: number(payment.amount), method: payment.method, reference: payment.reference, date: new Date(`${payment.paidOn}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), status: payment.status as Payment["status"], balance: number(student.feeBalance) }));
}
export async function recordPayment(studentId: string, amount: number, method: string, reference: string) {
  if (amount <= 0 || !validPaymentPrecision(amount)) throw new Error("Payment amount must be positive and have at most two decimal places");
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
    return row ? { id: row.id, studentId: student.id, receiptNumber, studentName: student.name, registrationNumber: student.registrationNumber, amount: number(row.amount), method, reference, date: getDateLabel(), status: "completed" as const, balance: number(updatedStudent?.feeBalance) } : undefined;
  });
}

export async function updatePayment(paymentId: string, amount: number, method: string, reference: string) {
  if (amount < 0 || !validPaymentPrecision(amount)) throw new Error("Payment amount must be non-negative and have at most two decimal places");
  const schoolId = await getSchoolId();
  return db.transaction(async (tx) => {
    const existing = (await tx.select({ payment: payments, student: students }).from(payments).innerJoin(students, eq(payments.studentId, students.id)).where(and(eq(payments.schoolId, schoolId), eq(payments.id, paymentId))).for("update").limit(1))[0];
    if (!existing) return undefined;
    const updated = (await tx.update(payments).set({ amount: String(amount), method, reference }).where(and(eq(payments.schoolId, schoolId), eq(payments.id, paymentId))).returning())[0];
    const totals = (await tx.select({ total: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'completed'), 0)` }).from(payments).where(and(eq(payments.schoolId, schoolId), eq(payments.studentId, existing.student.id))))[0];
    const amountPaid = number(totals?.total);
    const payable = existing.student.isSponsored ? 0 : number(existing.student.previousFeeBalance) + number(existing.student.termFee);
    if (updated.status === "completed" && number(updated.amount) > number(existing.payment.amount) && amountPaid > payable) {
      throw new Error("The corrected payment would exceed the pupil's payable fees");
    }
    const feeBalance = Math.max(0, payable - amountPaid);
    await tx.update(students).set({ amountPaid: String(amountPaid), feeBalance: String(feeBalance), updatedAt: new Date() }).where(and(eq(students.schoolId, schoolId), eq(students.id, existing.student.id)));
    return updated ? {
      id: updated.id,
      studentId: existing.student.id,
      receiptNumber: updated.receiptNumber,
      studentName: `${existing.student.firstName}${existing.student.middleName ? ` ${existing.student.middleName}` : ""} ${existing.student.lastName}`,
      registrationNumber: existing.student.registrationNumber,
      amount: number(updated.amount),
      method: updated.method,
      reference: updated.reference,
      date: new Date(`${updated.paidOn}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      status: updated.status as Payment["status"],
      balance: feeBalance,
    } : undefined;
  });
}

export async function listSalaryPayments() {
  const [legacyRows, normalizedRows, usersRows] = await Promise.all([
    listOperation("salaryPayments"),
    db.select().from(payrollPayments).where(eq(payrollPayments.schoolId, await getSchoolId())).orderBy(desc(payrollPayments.createdAt)),
    listUsers(),
  ]);
  const rows = [
    ...legacyRows.map((item) => ({
      id: item.id,
      staffId: String(item.staffId || ""),
      staffName: String(item.staffName || ""),
      monthlySalary: number(item.monthlySalary as number | string | undefined),
      period: String(item.period || ""),
      amount: number(item.amount as number | string | undefined),
      receiptNumber: String(item.receiptNumber || ""),
      paymentDate: String(item.paymentDate || ""),
      method: String(item.method || ""),
      reference: String(item.reference || ""),
      status: String(item.status || "Paid"),
    })),
    ...normalizedRows.map((item) => ({
      id: item.id,
      staffId: item.staffId,
      staffName: "",
      monthlySalary: 0,
      period: item.period,
      amount: number(item.amount),
      receiptNumber: item.receiptNumber,
      paymentDate: new Date(`${item.paidOn}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      method: item.method,
      reference: item.reference,
      status: item.status === "reversed" ? "Reversed" : "Paid",
    })),
  ];
  const totals = new Map<string, number>();
  rows.filter((item) => item.status !== "Reversed").forEach((item) => {
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
  const period = data.period.trim();
  if (!period) throw new Error("Enter a salary period.");
  const schoolId = await getSchoolId();
  const rowId = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${schoolId}:${data.staffId}:${period}`}))`);
    const staffUser = (await tx.select().from(users).where(and(eq(users.schoolId, schoolId), eq(users.id, data.staffId))).limit(1))[0];
    if (!staffUser || !["teacher", "staff"].includes(staffUser.role)) throw new Error("Choose a registered teacher or staff member.");
    const monthlySalary = number(staffUser.monthlySalary);
    if (monthlySalary <= 0) throw new Error("Register a monthly salary for this staff member before paying them.");
    const [legacyRows, normalizedRows] = await Promise.all([
      listOperation("salaryPayments"),
      tx.select().from(payrollPayments).where(and(eq(payrollPayments.schoolId, schoolId), eq(payrollPayments.staffId, data.staffId), eq(payrollPayments.period, period))),
    ]);
    const paidForPeriod = [
      ...legacyRows.filter((item) => String(item.staffId || "") === data.staffId && String(item.period || "") === period && String(item.status || "Paid") !== "Reversed").map((item) => number(item.amount as number | string | undefined)),
      ...normalizedRows.filter((item) => item.status !== "reversed").map((item) => number(item.amount)),
    ].reduce((sum, amount) => sum + amount, 0);
    const balance = Math.max(0, monthlySalary - paidForPeriod);
    if (data.amount > balance) throw new Error(`Payment exceeds the ${period} salary balance of ${balance}.`);
    const year = new Date().getFullYear();
    const sequence = (await tx.insert(recordSequences).values({ schoolId, year, kind: "salary_receipt", value: 1 }).onConflictDoUpdate({
      target: [recordSequences.schoolId, recordSequences.year, recordSequences.kind],
      set: { value: sql`${recordSequences.value} + 1`, updatedAt: new Date() },
    }).returning({ value: recordSequences.value }))[0];
    if (!sequence) throw new Error("Unable to allocate salary receipt number");
    const inserted = (await tx.insert(payrollPayments).values({
      schoolId,
      staffId: staffUser.id,
      period,
      amount: String(data.amount),
      method: data.method.trim(),
      reference: data.reference.trim(),
      receiptNumber: `SAL-${year}-${String(sequence.value).padStart(4, "0")}`,
      paidOn: new Date().toISOString().slice(0, 10),
      status: "paid",
    }).returning({ id: payrollPayments.id }))[0];
    if (!inserted) throw new Error("Unable to record salary payment");
    return inserted.id;
  });
  return (await listSalaryPayments()).find((item) => item.id === rowId);
}

const tables = { announcements, assignments, classes, discipline, documents, events, expenses, inventory, library, medical, notifications, parents, reports, salaryPayments, staff, subjects, timetable, transport } as const;
export type OperationKind = keyof typeof tables;
export async function searchSupportPupils(search: string) {
  const value = search.trim();
  if (value.length < 2) return [];
  const pattern = `%${value}%`;
  const rows = await db.select({
    id: students.id,
    schoolName: schoolSettings.schoolName,
    registrationNumber: students.registrationNumber,
    firstName: students.firstName,
    middleName: students.middleName,
    lastName: students.lastName,
    className: students.className,
    stream: students.stream,
    status: students.status,
    isSponsored: students.isSponsored,
  }).from(students)
    .innerJoin(schoolSettings, eq(students.schoolId, schoolSettings.id))
    .where(or(
      ilike(students.registrationNumber, pattern),
      ilike(students.firstName, pattern),
      ilike(students.middleName, pattern),
      ilike(students.lastName, pattern),
      ilike(students.guardianName, pattern),
      sql`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName}) ilike ${pattern}`,
    ))
    .orderBy(asc(schoolSettings.schoolName), asc(students.lastName), asc(students.firstName))
    .limit(50);
  return rows.map((row) => ({
    id: row.id,
    schoolName: row.schoolName,
    registrationNumber: row.registrationNumber,
    name: `${row.firstName}${row.middleName ? ` ${row.middleName}` : ""} ${row.lastName}`,
    className: row.className,
    stream: row.stream,
    status: row.status as SchoolStudent["status"],
    isSponsored: row.isSponsored,
  }));
}

export async function listOperation(kind: OperationKind): Promise<OperationRecord[]> {
  const schoolId = await getSchoolId();
  const table = tables[kind];
  const rows = await db.select().from(table).where(eq(table.schoolId, schoolId)).orderBy(desc(table.createdAt));
  return rows
    .map((row): OperationRecord => ({ ...(row.data as Record<string, unknown>), id: row.id }))
    .filter((record) => kind !== "notifications" || record["smsDelivery"] !== true);
}
export async function getOperation(kind: OperationKind, id: string) {
  const schoolId = await getSchoolId();
  const table = tables[kind];
  const row = (await db.select().from(table).where(and(eq(table.schoolId, schoolId), eq(table.id, id))).limit(1))[0];
  if (!row) return undefined;
  const record: OperationRecord = { ...(row.data as Record<string, unknown>), id: row.id };
  if (kind === "notifications" && record["smsDelivery"] === true) return undefined;
  return record;
}
export async function buildFullBackup() {
  const schoolId = await getSchoolId();
  const [settingsRows, studentRows, userRows, paymentRows, attendanceRows, sequenceRows, loginAttemptRows] = await Promise.all([
    db.select().from(schoolSettings).where(eq(schoolSettings.id, schoolId)),
    db.select().from(students).where(eq(students.schoolId, schoolId)),
    db.select().from(users).where(eq(users.schoolId, schoolId)),
    db.select().from(payments).where(eq(payments.schoolId, schoolId)),
    db.select().from(attendance).where(eq(attendance.schoolId, schoolId)),
    db.select().from(recordSequences).where(eq(recordSequences.schoolId, schoolId)),
    db.select().from(loginAttempts),
  ]);
  const userIds = userRows.map((row) => row.id);
  const sessionRows = userIds.length ? await db.select().from(sessions).where(inArray(sessions.userId, userIds)) : [];
  const operationEntries = await Promise.all(Object.entries(tables).map(async ([kind, table]) => [
    kind,
    await db.select().from(table).where(eq(table.schoolId, schoolId)),
  ] as const));
  const photoPaths = [...new Set(studentRows.map((row) => row.photoPath).filter((value): value is string => Boolean(value)))];
  const pupilPhotos = await Promise.all(photoPaths.map(async (path) => {
    const response = await fetch(await requestObjectDownload(path));
    if (!response.ok) throw new Error(`Unable to include pupil photo ${path} in the backup.`);
    return {
      path,
      contentType: response.headers.get("content-type") || "application/octet-stream",
      data: Buffer.from(await response.arrayBuffer()).toString("base64"),
    };
  }));
  const operations = Object.fromEntries(operationEntries);
  const tablesInBackup = {
    schoolSettings: settingsRows,
    students: studentRows,
    users: userRows,
    sessions: sessionRows,
    loginAttempts: loginAttemptRows,
    payments: paymentRows,
    attendance: attendanceRows,
    recordSequences: sequenceRows,
    ...operations,
  };
  return {
    format: "emmecty-school-full-backup",
    version: 1,
    generatedAt: new Date().toISOString(),
    schoolId,
    tables: tablesInBackup,
    files: { pupilPhotos },
    tableCounts: Object.fromEntries(Object.entries(tablesInBackup).map(([name, rows]) => [name, rows.length])),
    fileCounts: { pupilPhotos: pupilPhotos.length },
  };
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
  if (row && kind === "events") {
    const eventTitle = String(data.title || "School event");
    const eventDate = String(data.date || "");
    const eventType = String(data.type || "School event");
    await createOperation("notifications", {
      title: eventType.toLowerCase().includes("holiday") ? `Public holiday: ${eventTitle}` : eventTitle,
      body: compactSingleSegmentSms(eventDate ? `${eventType} is scheduled for ${eventDate}.` : `${eventType} has been added to the school calendar.`),
      read: false,
      date: getDateLabel(),
      source: "event",
    });
  }
  return row ? { ...(row.data as OperationRecord), id: row.id } : undefined;
}
export async function createSchoolNotification(data: { title: string; body: string; source?: string }) {
  return createOperation("notifications", {
    title: data.title.trim(),
    body: compactSingleSegmentSms(data.body),
    read: false,
    date: getDateLabel(),
    source: data.source || "school",
  });
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

export async function permanentlyDeleteSupportPupil(
  id: string,
  confirmRegistrationNumber: string,
  removePhoto: (photoPath: string) => Promise<void>,
) {
  return db.transaction(async (tx) => {
    const pupil = (await tx.select().from(students).where(eq(students.id, id)).for("update").limit(1))[0];
    if (!pupil) return undefined;
    if (pupil.registrationNumber !== confirmRegistrationNumber) {
      throw new Error("The registration number confirmation does not match.");
    }

    const linkedPhoto = pupil.photoPath;
    const otherPhotoOwner = linkedPhoto
      ? (await tx.select({ id: students.id }).from(students).where(and(eq(students.photoPath, linkedPhoto), ne(students.id, pupil.id))).limit(1))[0]
      : undefined;
    let photoStatus: "not_present" | "removed" | "shared" = "not_present";
    if (linkedPhoto) {
      if (otherPhotoOwner) photoStatus = "shared";
      else {
        await removePhoto(linkedPhoto);
        photoStatus = "removed";
      }
    }

    const attendanceRows = await tx.delete(attendance)
      .where(and(eq(attendance.schoolId, pupil.schoolId), eq(attendance.studentId, pupil.id)))
      .returning({ id: attendance.id });
    const paymentRows = await tx.delete(payments)
      .where(and(eq(payments.schoolId, pupil.schoolId), eq(payments.studentId, pupil.id)))
      .returning({ id: payments.id });
    const accountRows = await tx.delete(users)
      .where(and(eq(users.schoolId, pupil.schoolId), eq(users.studentId, pupil.id)))
      .returning({ id: users.id });

    let deletedLinkedRecords = 0;
    for (const table of Object.values(tables)) {
      const removed = await tx.delete(table).where(and(
        eq(table.schoolId, pupil.schoolId),
        sql`jsonb_path_exists(${table.data}, '$.** ? (@ == $targetId)', jsonb_build_object('targetId', ${pupil.id}::text))`,
      )).returning({ id: table.id });
      deletedLinkedRecords += removed.length;
    }

    const deletedPupil = await tx.delete(students).where(and(eq(students.id, pupil.id), eq(students.schoolId, pupil.schoolId))).returning({ id: students.id });
    if (!deletedPupil.length) throw new Error("The pupil record could not be deleted.");

    return {
      id: pupil.id,
      schoolId: pupil.schoolId,
      name: `${pupil.firstName}${pupil.middleName ? ` ${pupil.middleName}` : ""} ${pupil.lastName}`,
      registrationNumber: pupil.registrationNumber,
      photoStatus,
      deletedAttendanceRecords: attendanceRows.length,
      deletedPaymentRecords: paymentRows.length,
      deletedLinkedAccounts: accountRows.length,
      deletedLinkedRecords,
    };
  });
}
export async function saveAttendance(studentId: string, date: string, status: AttendanceStatus, arrivalTime?: string | null) {
  const student = await getStudent(studentId);
  if (!student) return undefined;
  const schoolId = await getSchoolId();
  const row = (await db.insert(attendance).values({ schoolId, studentId: student.id, date, status, arrivalTime: arrivalTime || null }).onConflictDoUpdate({ target: [attendance.studentId, attendance.date], set: { status, arrivalTime: arrivalTime || null, updatedAt: new Date() } }).returning())[0];
  return row ? { id: row.id, studentId: student.id, studentName: student.name, registrationNumber: student.registrationNumber, className: classAssignmentKey(student.className, student.stream), date: row.date, status: row.status as AttendanceStatus, arrivalTime: row.arrivalTime } : undefined;
}
export async function listAttendance() {
  const schoolId = await getSchoolId();
  const rows = await db.select({ record: attendance, student: students }).from(attendance).innerJoin(students, eq(attendance.studentId, students.id)).where(and(eq(attendance.schoolId, schoolId), isNull(attendance.deletedAt))).orderBy(desc(attendance.date));
  return rows.map(({ record, student }) => ({ id: record.id, studentId: student.id, studentName: `${student.firstName}${student.middleName ? ` ${student.middleName}` : ""} ${student.lastName}`, registrationNumber: student.registrationNumber, className: classAssignmentKey(student.className, student.stream), date: record.date, status: record.status as AttendanceStatus, arrivalTime: record.arrivalTime }));
}

export async function listDeletedAttendanceRegisters() {
  const schoolId = await getSchoolId();
  const rows = await db.select({ record: attendance, student: students }).from(attendance).innerJoin(students, eq(attendance.studentId, students.id)).where(and(eq(attendance.schoolId, schoolId), isNotNull(attendance.deletedAt))).orderBy(desc(attendance.deletedAt));
  const groups = new Map<string, DeletedAttendanceRegister>();
  for (const { record, student } of rows) {
    const className = classAssignmentKey(student.className, student.stream);
    const key = `${record.date}|${className}|${record.deletedAt?.toISOString() || ""}`;
    const current = groups.get(key);
    if (current) current.recordCount += 1;
    else groups.set(key, { date: record.date, className, recordCount: 1, reason: record.deletionReason || "No reason provided", deletedAt: record.deletedAt!.toISOString(), deletedBy: record.deletedBy });
  }
  return Array.from(groups.values()).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export async function deleteAttendanceRegister(date: string, className: string, reason: string, deletedBy: string) {
  const schoolId = await getSchoolId();
  const rows = await db.select({ record: attendance, student: students }).from(attendance).innerJoin(students, eq(attendance.studentId, students.id)).where(and(eq(attendance.schoolId, schoolId), eq(attendance.date, date), isNull(attendance.deletedAt)));
  const matching = rows.filter(({ student }) => classAssignmentKey(student.className, student.stream) === className);
  if (!matching.length) return undefined;
  const deletedAt = new Date();
  await db.update(attendance).set({ deletedAt, deletedBy, deletionReason: reason, updatedAt: deletedAt }).where(and(eq(attendance.schoolId, schoolId), inArray(attendance.id, matching.map(({ record }) => record.id))));
  return { date, className, recordCount: matching.length, reason, deletedAt: deletedAt.toISOString(), deletedBy };
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
      return row ? { id: row.id, studentId: student.id, studentName: student.name, registrationNumber: student.registrationNumber, className: classAssignmentKey(student.className, student.stream), date: row.date, status: row.status as AttendanceStatus, arrivalTime: row.arrivalTime } : undefined;
  }));
  return created.filter((item): item is NonNullable<typeof item> => !!item);
}
