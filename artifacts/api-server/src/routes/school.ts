import { Router, type IRouter } from "express";
import {
  AttendanceRecord,
  CreateAnnouncementBody,
  CreateAnnouncementResponse,
  CreateStudentBody,
  CreateStudentResponse,
  GetAttendanceQueryParams,
  GetAttendanceResponse,
  GetCurrentUserResponse,
  GetDashboardResponse,
  GetFinanceSummaryResponse,
  GetReportCardParams,
  GetReportCardResponse,
  GetStudentParams,
  GetStudentResponse,
  GetTimetableResponse,
  ListAnnouncementsResponse,
  ListPaymentsResponse,
  ListStudentsQueryParams,
  ListStudentsResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  RecordPaymentBody,
  RecordPaymentResponse,
  SaveAttendanceBody,
  SaveAttendanceResponse,
} from "@workspace/api-zod";
import {
  announcements,
  attendance,
  currentUserFromToken,
  getDateLabel,
  getStudent,
  makeSession,
  nextRegistrationNumber,
  payments,
  publicUser,
  sessionStore,
  students,
  timetable,
  users,
  type AttendanceStatus,
  type SchoolRole,
  verifyPassword,
} from "../lib/school-data";

const router: IRouter = Router();

function getCookie(req: Parameters<Parameters<IRouter["get"]>[1]>[0], name: string) {
  const header = req.headers.cookie ?? "";
  const pair = header.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return pair?.slice(name.length + 1);
}

function setSessionCookie(res: Parameters<Parameters<IRouter["get"]>[1]>[1], token: string) {
  res.setHeader("Set-Cookie", `schoolops_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`);
}

function requireUser(req: Parameters<Parameters<IRouter["get"]>[1]>[0]) {
  return currentUserFromToken(getCookie(req, "schoolops_session"));
}

function roleGreeting(name: string) {
  return `Good morning, ${name.split(" ")[0]}`;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter your login details to continue." });
    return;
  }

  const user = users.find(
    (candidate) =>
      candidate.userType === parsed.data.userType &&
      candidate.identifier.toLowerCase() === parsed.data.identifier.toLowerCase() &&
      verifyPassword(parsed.data.password, candidate.password),
  );

  if (!user) {
    req.log.warn({ identifier: parsed.data.identifier }, "SchoolOps login rejected");
    res.status(401).json({ error: "Those details do not match an active account." });
    return;
  }

  const token = makeSession(user.id);
  setSessionCookie(res, token);
  req.log.info({ userId: user.id, role: user.role }, "SchoolOps login accepted");
  res.json(LoginResponse.parse({
    user: publicUser(user),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = getCookie(req, "schoolops_session");
  if (token) sessionStore.delete(token);
  res.setHeader("Set-Cookie", "schoolops_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
  res.json(LogoutResponse.parse({ message: "Signed out successfully." }));
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(GetCurrentUserResponse.parse({
    user: publicUser(user),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  }));
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const user = requireUser(req);
  const role: SchoolRole = user?.role ?? "administrator";
  const visibleStudents = user?.studentId ? students.filter((student) => student.id === user.studentId) : students;
  const presentCount = attendance.filter((record) => record.status === "present").length;
  const absentCount = attendance.filter((record) => record.status === "absent").length;
  const feeCollected = payments.reduce((total, payment) => total + payment.amount, 0);
  const payload = {
    role,
    greeting: roleGreeting(user?.name ?? "Amara Njeri"),
    summary: {
      students: role === "student" || role === "guardian" ? visibleStudents.length : students.length,
      teachers: 24,
      staff: 38,
      classes: 18,
      attendance: Math.round((presentCount / attendance.length) * 100),
      absent: absentCount,
      feesCollected: feeCollected,
      outstandingFees: students.reduce((total, student) => total + student.feeBalance, 0),
    },
    attendanceTrend: [
      { day: "Mon", present: 94, absent: 6 },
      { day: "Tue", present: 92, absent: 8 },
      { day: "Wed", present: 96, absent: 4 },
      { day: "Thu", present: 93, absent: 7 },
      { day: "Fri", present: 95, absent: 5 },
    ],
    performance: [
      { subject: "Mathematics", average: 78 },
      { subject: "English", average: 84 },
      { subject: "Science", average: 72 },
      { subject: "Social Studies", average: 81 },
      { subject: "Creative Arts", average: 88 },
    ],
    recentAdmissions: students.slice(0, 4),
    upcomingEvents: [
      { title: "Staff planning afternoon", date: "02 Sep", type: "Staff" },
      { title: "Term 3 begins", date: "07 Sep", type: "Academic" },
      { title: "Parents' forum", date: "12 Sep", type: "Community" },
    ],
    quickActions: role === "teacher"
      ? ["Record attendance", "Enter assessment", "Post announcement"]
      : role === "accountant"
        ? ["Record payment", "View fee balances", "Export collection report"]
        : ["Register pupil", "Take attendance", "Send announcement", "View reports"],
    assignedClasses: role === "teacher" ? ["Primary 4 East", "Primary 5 West"] : undefined,
    assignedSubjects: role === "teacher" ? ["Mathematics", "Science"] : undefined,
    children: role === "guardian" ? visibleStudents : undefined,
    feeBalance: role === "guardian" || role === "student" ? visibleStudents[0]?.feeBalance ?? 0 : undefined,
    latestResult: role === "guardian" || role === "student" ? 82 : undefined,
  };

  res.json(GetDashboardResponse.parse(payload));
});

router.get("/students", async (req, res): Promise<void> => {
  const parsed = ListStudentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid student filters." });
    return;
  }
  const search = parsed.data.search?.toLowerCase() ?? "";
  const result = students.filter((student) => {
    const matchesSearch = !search || [student.name, student.registrationNumber, student.className, student.guardianName]
      .some((field) => field.toLowerCase().includes(search));
    const matchesClass = !parsed.data.className || student.className === parsed.data.className;
    const matchesStatus = !parsed.data.status || student.status === parsed.data.status;
    return matchesSearch && matchesClass && matchesStatus;
  });
  res.json(ListStudentsResponse.parse(result));
});

router.post("/students", async (req, res): Promise<void> => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Complete the required pupil and guardian fields." });
    return;
  }
  const data = parsed.data;
  const student = {
    id: `stu-${String(students.length + 1).padStart(3, "0")}`,
    registrationNumber: nextRegistrationNumber(),
    name: `${data.firstName}${data.middleName ? ` ${data.middleName}` : ""} ${data.lastName}`,
    firstName: data.firstName,
    lastName: data.lastName,
    middleName: data.middleName,
    className: data.className,
    stream: data.stream,
    gender: data.gender,
    status: "active" as const,
    attendancePercentage: 100,
    feeBalance: 0,
    avatarTone: "mint",
    dateOfBirth: data.dateOfBirth,
    guardianName: data.guardianName,
    guardianPhone: data.guardianPhone,
    guardianEmail: "",
    admissionDate: getDateLabel(),
  };
  students.unshift(student);
  req.log.info({ studentId: student.id, registrationNumber: student.registrationNumber }, "Student registered");
  res.status(201).json(CreateStudentResponse.parse(student));
});

router.get("/students/:studentId", async (req, res): Promise<void> => {
  const parsed = GetStudentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid student id." });
    return;
  }
  const student = getStudent(parsed.data.studentId);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  const user = requireUser(req);
  if ((user?.role === "student" || user?.role === "guardian") && user.studentId !== student.id) {
    res.status(403).json({ error: "You do not have access to this pupil." });
    return;
  }
  res.json(GetStudentResponse.parse({
    ...student,
    academicHistory: [
      { term: "Term 1 2026", average: 78, grade: "B" },
      { term: "Term 2 2026", average: 82, grade: "B+" },
      { term: "Term 3 2026", average: 84, grade: "A-" },
    ],
  }));
});

router.get("/attendance", async (req, res): Promise<void> => {
  const parsed = GetAttendanceQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid attendance filters." });
    return;
  }
  const result = attendance.filter((record) =>
    (!parsed.data.date || record.date === parsed.data.date) &&
    (!parsed.data.className || record.className === parsed.data.className),
  );
  res.json(GetAttendanceResponse.parse(result));
});

router.post("/attendance", async (req, res): Promise<void> => {
  const parsed = SaveAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a pupil, date, and attendance status." });
    return;
  }
  const student = getStudent(parsed.data.studentId);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  const existing = attendance.find((record) => record.studentId === student.id && record.date === parsed.data.date);
  const record = existing ?? {
    id: `att-${student.id}-${parsed.data.date}`,
    studentId: student.id,
    studentName: student.name,
    registrationNumber: student.registrationNumber,
    className: student.className,
    date: parsed.data.date,
    status: parsed.data.status as AttendanceStatus,
  };
  record.status = parsed.data.status as AttendanceStatus;
  if (!existing) attendance.push(record);
  res.json(SaveAttendanceResponse.parse(record));
});

router.get("/finance/summary", async (_req, res): Promise<void> => {
  const collected = payments.filter((payment) => payment.status === "completed").reduce((total, payment) => total + payment.amount, 0);
  const outstanding = students.reduce((total, student) => total + student.feeBalance, 0);
  res.json(GetFinanceSummaryResponse.parse({
    collected,
    outstanding,
    collectionRate: Math.round((collected / (collected + outstanding)) * 100),
    trend: 12.4,
    monthly: [
      { month: "Apr", amount: 128000 },
      { month: "May", amount: 152000 },
      { month: "Jun", amount: 148500 },
      { month: "Jul", amount: 176000 },
      { month: "Aug", amount: collected },
    ],
  }));
});

router.get("/finance/payments", async (_req, res): Promise<void> => {
  res.json(ListPaymentsResponse.parse(payments));
});

router.post("/finance/payments", async (req, res): Promise<void> => {
  const parsed = RecordPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid student, amount, method, and reference." });
    return;
  }
  const student = getStudent(parsed.data.studentId);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  student.feeBalance = Math.max(0, student.feeBalance - parsed.data.amount);
  const payment = {
    id: `pay-${String(payments.length + 1).padStart(3, "0")}`,
    receiptNumber: `RCPT-2026-${String(185 + payments.length).padStart(4, "0")}`,
    studentName: student.name,
    registrationNumber: student.registrationNumber,
    amount: parsed.data.amount,
    method: parsed.data.method,
    date: getDateLabel(),
    status: "completed" as const,
  };
  payments.unshift(payment);
  req.log.info({ paymentId: payment.id, studentId: student.id }, "Fee payment recorded");
  res.status(201).json(RecordPaymentResponse.parse(payment));
});

router.get("/announcements", async (_req, res): Promise<void> => {
  res.json(ListAnnouncementsResponse.parse(announcements));
});

router.post("/announcements", async (req, res): Promise<void> => {
  const parsed = CreateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Add a title and message before publishing." });
    return;
  }
  const item = {
    id: `ann-${String(announcements.length + 1).padStart(3, "0")}`,
    title: parsed.data.title,
    body: parsed.data.body,
    audience: parsed.data.audience,
    publishedAt: getDateLabel(),
    author: requireUser(req)?.name ?? "School administrator",
    priority: parsed.data.priority,
  };
  announcements.unshift(item);
  res.status(201).json(CreateAnnouncementResponse.parse(item));
});

router.get("/academics/timetable", async (_req, res): Promise<void> => {
  res.json(GetTimetableResponse.parse(timetable));
});

router.get("/academics/report-cards/:studentId", async (req, res): Promise<void> => {
  const parsed = GetReportCardParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid student id." });
    return;
  }
  const student = getStudent(parsed.data.studentId);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json(GetReportCardResponse.parse({
    student,
    term: "Term 3",
    academicYear: "2026",
    overallAverage: 84,
    overallGrade: "A-",
    position: 7,
    teacherComment: "A thoughtful learner who contributes positively in class. Keep building confidence when explaining ideas aloud.",
    subjects: [
      { subject: "Mathematics", score: 86, max: 100, grade: "A-", comment: "Strong number sense." },
      { subject: "English", score: 88, max: 100, grade: "A", comment: "Excellent reading progress." },
      { subject: "Science", score: 79, max: 100, grade: "B+", comment: "Curious and engaged." },
      { subject: "Social Studies", score: 82, max: 100, grade: "B+", comment: "Consistent classwork." },
      { subject: "Creative Arts", score: 91, max: 100, grade: "A", comment: "Wonderful imagination." },
    ],
  }));
});

export default router;