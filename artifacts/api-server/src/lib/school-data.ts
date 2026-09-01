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
  userType: "staff" | "guardian" | "learner";
  role: SchoolRole;
  initials: string;
  schoolName: string;
  studentId?: string;
};

export function hashPassword(password: string) {
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
  enrollmentType?: "day" | "boarding";
  termFee?: number;
  amountPaid?: number;
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

export type SchoolClass = {
  id: string;
  name: string;
  grade: string;
  stream: string;
  teacherName: string;
  teacherId: string;
  pupilCount: number;
  room: string;
  subjectCount: number;
};

export type Assignment = {
  id: string;
  title: string;
  subject: string;
  className: string;
  dueDate: string;
  status: string;
  teacherName: string;
};

export type StaffRecord = {
  id: string;
  name: string;
  role: string;
  username: string;
  phone: string;
  status: string;
};

export type ParentRecord = {
  id: string;
  name: string;
  phone: string;
  children: number;
  studentId: string;
};

export type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: string;
};

export type DisciplineCase = {
  id: string;
  studentName: string;
  className: string;
  incident: string;
  level: string;
  date: string;
  status: string;
  studentId: string;
};

export type MedicalRecord = {
  id: string;
  studentName: string;
  className: string;
  condition: string;
  notes: string;
  lastUpdated: string;
  studentId: string;
};

export type LibraryItem = {
  id: string;
  title: string;
  author: string;
  copiesAvailable: number;
  status: string;
};

export type TransportRoute = {
  id: string;
  route: string;
  driver: string;
  vehicle: string;
  students: number;
  status: string;
};

export type InventoryItem = {
  id: string;
  item: string;
  category: string;
  quantity: number;
  reorderLevel: number;
  status: string;
};

export type SchoolEvent = {
  id: string;
  title: string;
  date: string;
  type: string;
  location: string;
  status: string;
};

export type DocumentRecord = {
  id: string;
  name: string;
  type: string;
  updatedAt: string;
  visibility: string;
};

export type ReportRecord = {
  id: string;
  title: string;
  description: string;
  period: string;
  status: string;
};

export type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  date: string;
};

export type SalaryPayment = {
  id: string;
  staffName: string;
  period: string;
  amount: number;
  paymentDate: string;
  method: string;
  status: string;
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
    name: "School administrator",
    identifier: "admin",
    password: hashPassword("admin123"),
    userType: "staff",
    role: "administrator",
    initials: "SA",
    schoolName: "School name",
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

export const classes: SchoolClass[] = [
  { id: "class-4-east", name: "Primary 4 East", grade: "Primary 4", stream: "East", teacherId: "usr-teacher", teacherName: "David Otieno", pupilCount: 28, room: "Room 4", subjectCount: 8 },
  { id: "class-5-west", name: "Primary 5 West", grade: "Primary 5", stream: "West", teacherId: "usr-teacher", teacherName: "David Otieno", pupilCount: 31, room: "Room 5", subjectCount: 8 },
  { id: "class-3-north", name: "Primary 3 North", grade: "Primary 3", stream: "North", teacherId: "usr-other-teacher", teacherName: "Lucy Wanjala", pupilCount: 26, room: "Room 3", subjectCount: 8 },
  { id: "class-6-east", name: "Primary 6 East", grade: "Primary 6", stream: "East", teacherId: "usr-other-teacher", teacherName: "Mercy Achieng", pupilCount: 24, room: "Room 6", subjectCount: 8 },
];

export const assignments: Assignment[] = [
  { id: "assignment-1", title: "Fractions practice", subject: "Mathematics", className: "Primary 4 East", dueDate: "04 Sep 2026", status: "Open", teacherName: "David Otieno" },
  { id: "assignment-2", title: "The water cycle poster", subject: "Science", className: "Primary 5 West", dueDate: "08 Sep 2026", status: "Open", teacherName: "David Otieno" },
  { id: "assignment-3", title: "Reading journal", subject: "English", className: "Primary 4 East", dueDate: "10 Sep 2026", status: "Draft", teacherName: "Lucy Wanjala" },
];

export const subjects = [
  { id: "subject-math", name: "Mathematics", teacherId: "usr-teacher" },
  { id: "subject-science", name: "Science", teacherId: "usr-teacher" },
  { id: "subject-english", name: "English", teacherId: "usr-other-teacher" },
  { id: "subject-social", name: "Social Studies", teacherId: "usr-other-teacher" },
];

export const staffRecords: StaffRecord[] = [
  { id: "usr-admin", name: "School administrator", role: "Administrator", username: "admin", phone: "Not provided", status: "Active" },
  { id: "usr-teacher", name: "David Otieno", role: "Teacher", username: "teacher", phone: "+256 700 111 002", status: "Active" },
  { id: "usr-accountant", name: "Grace Wambui", role: "Accountant", username: "accountant", phone: "+256 700 111 003", status: "Active" },
  { id: "staff-transport", name: "Joseph Kato", role: "Driver", username: "j.kato", phone: "+256 700 111 004", status: "Active" },
];

export const parents: ParentRecord[] = [
  { id: "parent-001", name: "Wanjiku Kamau", phone: "+256 701 234 001", children: 1, studentId: "stu-001" },
  { id: "parent-002", name: "Peter Mwangi", phone: "+256 701 234 002", children: 1, studentId: "stu-002" },
  { id: "parent-003", name: "Esther Wambui", phone: "+256 701 234 003", children: 1, studentId: "stu-003" },
];

export const expenses: Expense[] = [
  { id: "expense-001", category: "Utilities", description: "August electricity bill", amount: 480000, date: "28 Aug 2026", status: "Approved" },
  { id: "expense-002", category: "Learning materials", description: "Exercise books and art supplies", amount: 735000, date: "25 Aug 2026", status: "Approved" },
  { id: "expense-003", category: "Maintenance", description: "Classroom window repairs", amount: 210000, date: "21 Aug 2026", status: "Pending approval" },
];

export const disciplineCases: DisciplineCase[] = [
  { id: "discipline-001", studentId: "stu-004", studentName: "Daniel Ochieng", className: "Primary 3 North", incident: "Repeated late arrival", level: "Low", date: "29 Aug 2026", status: "Open" },
  { id: "discipline-002", studentId: "stu-002", studentName: "Brian Mwangi", className: "Primary 4 East", incident: "Excellent peer leadership", level: "Positive", date: "27 Aug 2026", status: "Recorded" },
];

export const medicalRecords: MedicalRecord[] = [
  { id: "medical-001", studentId: "stu-001", studentName: "Amani Kamau", className: "Primary 4 East", condition: "Asthma", notes: "Inhaler stored with the school office.", lastUpdated: "18 Aug 2026" },
  { id: "medical-002", studentId: "stu-005", studentName: "Ethan Kariuki", className: "Primary 6 East", condition: "Food allergy", notes: "Avoid peanuts at school events.", lastUpdated: "12 Aug 2026" },
];

export const libraryItems: LibraryItem[] = [
  { id: "book-001", title: "The River Between", author: "Ngũgĩ wa Thiong'o", copiesAvailable: 6, status: "Available" },
  { id: "book-002", title: "Oxford Primary Atlas", author: "Oxford", copiesAvailable: 2, status: "Low stock" },
  { id: "book-003", title: "A Child's Garden of Verses", author: "Robert Louis Stevenson", copiesAvailable: 9, status: "Available" },
];

export const transportRoutes: TransportRoute[] = [
  { id: "route-001", route: "Kira – Ntinda", driver: "Joseph Kato", vehicle: "UAX 204K · Bus 01", students: 18, status: "On route" },
  { id: "route-002", route: "Bukoto – Kololo", driver: "Sarah Namusoke", vehicle: "UBF 918L · Bus 02", students: 14, status: "At school" },
];

export const inventoryItems: InventoryItem[] = [
  { id: "inventory-001", item: "Exercise books", category: "Learning materials", quantity: 480, reorderLevel: 150, status: "Healthy" },
  { id: "inventory-002", item: "Whiteboard markers", category: "Classroom", quantity: 42, reorderLevel: 50, status: "Reorder soon" },
  { id: "inventory-003", item: "First aid kits", category: "Health & safety", quantity: 8, reorderLevel: 4, status: "Healthy" },
];

export const schoolEvents: SchoolEvent[] = [
  { id: "event-001", title: "Term 3 begins", date: "07 Sep 2026", type: "Academic", location: "All classrooms", status: "Upcoming" },
  { id: "event-002", title: "Parents' forum", date: "12 Sep 2026", type: "Community", location: "Main hall", status: "Upcoming" },
  { id: "event-003", title: "Inter-house sports", date: "19 Sep 2026", type: "Activities", location: "School field", status: "Planning" },
];

export const documents: DocumentRecord[] = [
  { id: "document-001", name: "Term 3 academic calendar", type: "PDF", updatedAt: "30 Aug 2026", visibility: "Entire school" },
  { id: "document-002", name: "Safeguarding policy", type: "PDF", updatedAt: "14 Aug 2026", visibility: "Staff only" },
  { id: "document-003", name: "Transport routes and pickup points", type: "Spreadsheet", updatedAt: "10 Aug 2026", visibility: "Guardians & staff" },
];

export const reports: ReportRecord[] = [
  { id: "report-001", title: "Term 2 academic performance", description: "Class and subject performance overview", period: "Term 2 2026", status: "Ready" },
  { id: "report-002", title: "August fee collection", description: "Collected, outstanding, and payment method breakdown", period: "August 2026", status: "Ready" },
  { id: "report-003", title: "Attendance exceptions", description: "Learners below the 90% attendance threshold", period: "Term 3 2026", status: "Draft" },
];

export const notifications: NotificationRecord[] = [
  { id: "notification-001", title: "Term 3 timetable published", body: "Your timetable and room assignments are ready to review.", read: false, date: "30 Aug 2026" },
  { id: "notification-002", title: "Parents' forum reminder", body: "The next forum is scheduled for 12 September in the main hall.", read: false, date: "29 Aug 2026" },
  { id: "notification-003", title: "Fee statement available", body: "A new statement is available for your linked learner.", read: true, date: "26 Aug 2026" },
];

export const currencyOptions = [
  { code: "UGX", name: "Ugandan Shilling", symbol: "UGX" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KES" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TZS" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
];

export const schoolSettings = {
  schoolName: "School name",
  academicYear: "2026",
  currencyCode: "UGX",
  currencyName: "Ugandan Shilling",
  currencySymbol: "UGX",
};

export const salaryPayments: SalaryPayment[] = [];

// The workspace starts with only the bootstrap administrator. All other
// records are created by authorized users from the application.
users.splice(1);
students.splice(0);
attendance.splice(0);
payments.splice(0);
announcements.splice(0);
timetable.splice(0);
classes.splice(0);
assignments.splice(0);
subjects.splice(0);
staffRecords.splice(1);
parents.splice(0);
expenses.splice(0);
disciplineCases.splice(0);
medicalRecords.splice(0);
libraryItems.splice(0);
transportRoutes.splice(0);
inventoryItems.splice(0);
schoolEvents.splice(0);
documents.splice(0);
reports.splice(0);
notifications.splice(0);

export const sessionStore = new Map<string, string>();

export function publicUser(user: SchoolUser) {
  return {
    id: user.id,
    name: user.name,
    identifier: user.identifier,
    role: user.role,
    initials: user.initials,
    schoolName: user.schoolName,
    studentId: user.studentId ?? null,
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