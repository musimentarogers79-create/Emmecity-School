import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

export type SchoolRole =
  | "super_admin"
  | "administrator"
  | "teacher"
  | "accountant"
  | "guardian"
  | "student"
  | "staff";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type SchoolUser = {
  id: string;
  name: string;
  identifier: string;
  password: string;
  userType: "staff" | "learner";
  role: SchoolRole;
  initials: string;
  schoolName: string;
  studentId?: string;
};

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedPassword: string) {
  const [salt, storedHash] = storedPassword.split(":");
  if (!salt || !storedHash) return false;
  const derivedHash = scryptSync(password, salt, 64);
  const expectedHash = Buffer.from(storedHash, "hex");
  return expectedHash.length === derivedHash.length && timingSafeEqual(expectedHash, derivedHash);
}

export type SchoolStudent = {
  id: string;
  registrationNumber: string;
  name: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  className: string;
  stream: string;
  gender: string;
  status: "active" | "inactive";
  attendancePercentage: number;
  feeBalance: number;
  avatarTone: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  admissionDate: string;
};

export type AttendanceRecord = {
  id: string;
  studentId: string;
  studentName: string;
  registrationNumber: string;
  className: string;
  date: string;
  status: AttendanceStatus;
};

export type Payment = {
  id: string;
  receiptNumber: string;
  studentName: string;
  registrationNumber: string;
  amount: number;
  method: string;
  date: string;
  status: "completed" | "pending" | "reversed";
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string;
  author: string;
  priority: "normal" | "important";
};

const now = new Date();
const today = now.toISOString().slice(0, 10);
const todayLabel = now.toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export const users: SchoolUser[] = [
  {
    id: "usr-admin",
    name: "Amara Njeri",
    identifier: "admin",
    password: hashPassword("admin123"),
    userType: "staff",
    role: "administrator",
    initials: "AN",
    schoolName: "Greenfield Primary School",
  },
  {
    id: "usr-teacher",
    name: "David Otieno",
    identifier: "teacher",
    password: hashPassword("teach123"),
    userType: "staff",
    role: "teacher",
    initials: "DO",
    schoolName: "Greenfield Primary School",
  },
  {
    id: "usr-accountant",
    name: "Grace Wambui",
    identifier: "accountant",
    password: hashPassword("account123"),
    userType: "staff",
    role: "accountant",
    initials: "GW",
    schoolName: "Greenfield Primary School",
  },
  {
    id: "usr-student",
    name: "Amani Kamau",
    identifier: "STU-2026-0001",
    password: hashPassword("pupil123"),
    userType: "learner",
    role: "student",
    initials: "AK",
    schoolName: "Greenfield Primary School",
    studentId: "stu-001",
  },
  {
    id: "usr-guardian",
    name: "Wanjiku Kamau",
    identifier: "GUARDIAN-001",
    password: hashPassword("parent123"),
    userType: "learner",
    role: "guardian",
    initials: "WK",
    schoolName: "Greenfield Primary School",
    studentId: "stu-001",
  },
];

export const students: SchoolStudent[] = [
  {
    id: "stu-001",
    registrationNumber: "STU-2026-0001",
    name: "Amani Kamau",
    firstName: "Amani",
    lastName: "Kamau",
    className: "Primary 4",
    stream: "East",
    gender: "Female",
    status: "active",
    attendancePercentage: 96,
    feeBalance: 0,
    avatarTone: "mint",
    dateOfBirth: "2017-04-16",
    guardianName: "Wanjiku Kamau",
    guardianPhone: "+254 712 345 678",
    guardianEmail: "wanjiku.kamau@example.com",
    admissionDate: "2022-01-10",
  },
  {
    id: "stu-002",
    registrationNumber: "STU-2026-0002",
    name: "Brian Mwangi",
    firstName: "Brian",
    lastName: "Mwangi",
    className: "Primary 4",
    stream: "East",
    gender: "Male",
    status: "active",
    attendancePercentage: 91,
    feeBalance: 12400,
    avatarTone: "blue",
    dateOfBirth: "2017-08-03",
    guardianName: "Peter Mwangi",
    guardianPhone: "+254 723 881 420",
    guardianEmail: "peter.mwangi@example.com",
    admissionDate: "2023-01-09",
  },
  {
    id: "stu-003",
    registrationNumber: "STU-2026-0003",
    name: "Chloe Wambui",
    firstName: "Chloe",
    lastName: "Wambui",
    className: "Primary 5",
    stream: "West",
    gender: "Female",
    status: "active",
    attendancePercentage: 98,
    feeBalance: 5600,
    avatarTone: "peach",
    dateOfBirth: "2016-02-21",
    guardianName: "Esther Wambui",
    guardianPhone: "+254 701 482 119",
    guardianEmail: "esther.wambui@example.com",
    admissionDate: "2021-01-11",
  },
  {
    id: "stu-004",
    registrationNumber: "STU-2026-0004",
    name: "Daniel Ochieng",
    firstName: "Daniel",
    lastName: "Ochieng",
    className: "Primary 3",
    stream: "North",
    gender: "Male",
    status: "active",
    attendancePercentage: 87,
    feeBalance: 18750,
    avatarTone: "violet",
    dateOfBirth: "2018-11-12",
    guardianName: "Mary Ochieng",
    guardianPhone: "+254 733 115 902",
    guardianEmail: "mary.ochieng@example.com",
    admissionDate: "2024-01-08",
  },
  {
    id: "stu-005",
    registrationNumber: "STU-2026-0005",
    name: "Ethan Kariuki",
    firstName: "Ethan",
    lastName: "Kariuki",
    className: "Primary 6",
    stream: "East",
    gender: "Male",
    status: "active",
    attendancePercentage: 94,
    feeBalance: 3200,
    avatarTone: "amber",
    dateOfBirth: "2015-06-29",
    guardianName: "Susan Kariuki",
    guardianPhone: "+254 714 920 376",
    guardianEmail: "susan.kariuki@example.com",
    admissionDate: "2020-01-13",
  },
  {
    id: "stu-006",
    registrationNumber: "STU-2026-0006",
    name: "Fatima Noor",
    firstName: "Fatima",
    lastName: "Noor",
    className: "Primary 2",
    stream: "West",
    gender: "Female",
    status: "active",
    attendancePercentage: 99,
    feeBalance: 0,
    avatarTone: "rose",
    dateOfBirth: "2019-01-07",
    guardianName: "Hassan Noor",
    guardianPhone: "+254 722 008 641",
    guardianEmail: "hassan.noor@example.com",
    admissionDate: "2025-01-06",
  },
];

export const attendance: AttendanceRecord[] = students.map((student, index) => ({
  id: `att-${student.id}-${today}`,
  studentId: student.id,
  studentName: student.name,
  registrationNumber: student.registrationNumber,
  className: student.className,
  date: today,
  status: index === 3 ? "late" : index === 1 ? "absent" : "present",
}));

export const payments: Payment[] = [
  {
    id: "pay-001",
    receiptNumber: "RCPT-2026-0184",
    studentName: "Amani Kamau",
    registrationNumber: "STU-2026-0001",
    amount: 28000,
    method: "Mobile money",
    date: "28 Aug 2026",
    status: "completed",
  },
  {
    id: "pay-002",
    receiptNumber: "RCPT-2026-0183",
    studentName: "Ethan Kariuki",
    registrationNumber: "STU-2026-0005",
    amount: 12000,
    method: "Bank transfer",
    date: "27 Aug 2026",
    status: "completed",
  },
  {
    id: "pay-003",
    receiptNumber: "RCPT-2026-0182",
    studentName: "Chloe Wambui",
    registrationNumber: "STU-2026-0003",
    amount: 18000,
    method: "Mobile money",
    date: "26 Aug 2026",
    status: "completed",
  },
  {
    id: "pay-004",
    receiptNumber: "RCPT-2026-0181",
    studentName: "Daniel Ochieng",
    registrationNumber: "STU-2026-0004",
    amount: 8500,
    method: "Cash",
    date: "26 Aug 2026",
    status: "completed",
  },
];

export const announcements: Announcement[] = [
  {
    id: "ann-001",
    title: "Welcome back, Greenfield",
    body: "The new term begins on Monday, 7 September. Please review the updated timetable and transport notices before the first day.",
    audience: "Entire school",
    publishedAt: "30 Aug 2026",
    author: "Amara Njeri",
    priority: "important",
  },
  {
    id: "ann-002",
    title: "Sports day registration is open",
    body: "House captains can submit final participant lists to the activities office by Thursday afternoon.",
    audience: "Teachers & pupils",
    publishedAt: "28 Aug 2026",
    author: "David Otieno",
    priority: "normal",
  },
  {
    id: "ann-003",
    title: "Fee statements are available",
    body: "Term 3 statements are now available for review. Contact the accounts office if you need a payment plan.",
    audience: "Parents & guardians",
    publishedAt: "26 Aug 2026",
    author: "Grace Wambui",
    priority: "normal",
  },
];

export const timetable = [
  { id: "tt-1", day: "Monday", time: "08:00–08:40", subject: "Mathematics", teacher: "David Otieno", className: "Primary 4 East", room: "Room 4", accent: "blue" },
  { id: "tt-2", day: "Monday", time: "09:00–09:40", subject: "English", teacher: "Lucy Wanjala", className: "Primary 4 East", room: "Room 4", accent: "green" },
  { id: "tt-3", day: "Tuesday", time: "10:00–10:40", subject: "Science", teacher: "David Otieno", className: "Primary 4 East", room: "Lab 1", accent: "violet" },
  { id: "tt-4", day: "Wednesday", time: "11:00–11:40", subject: "Social Studies", teacher: "David Otieno", className: "Primary 4 East", room: "Room 4", accent: "amber" },
  { id: "tt-5", day: "Thursday", time: "08:00–08:40", subject: "Creative Arts", teacher: "Mercy Achieng", className: "Primary 4 East", room: "Studio", accent: "peach" },
  { id: "tt-6", day: "Friday", time: "09:00–09:40", subject: "Physical Education", teacher: "David Otieno", className: "Primary 4 East", room: "Field", accent: "rose" },
];

export const sessionStore = new Map<string, string>();

export function publicUser(user: SchoolUser) {
  return {
    id: user.id,
    name: user.name,
    identifier: user.identifier,
    role: user.role,
    initials: user.initials,
    schoolName: user.schoolName,
  };
}

export function makeSession(userId: string) {
  const token = randomUUID();
  sessionStore.set(token, userId);
  return token;
}

export function currentUserFromToken(token: string | undefined) {
  const userId = token ? sessionStore.get(token) : undefined;
  return users.find((user) => user.id === userId);
}

export function getStudent(id: string) {
  return students.find((student) => student.id === id);
}

export function getDateLabel() {
  return todayLabel;
}

export function nextRegistrationNumber() {
  const next = students.length + 1;
  return `STU-${now.getFullYear()}-${String(next).padStart(4, "0")}`;
}