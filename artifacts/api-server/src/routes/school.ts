import { Router, type IRouter } from "express";
import {
  AttendanceRecord,
  CreateAnnouncementBody,
  CreateAnnouncementResponse,
  CreateExpenseBody,
  CreateExpenseResponse,
  CreateSalaryPaymentBody,
  CreateSalaryPaymentResponse,
  CreateStudentBody,
  CreateStudentResponse,
  CreateUserBody,
  CreateUserResponse,
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
  ListExpensesResponse,
  ListPaymentsResponse,
  ListSalariesResponse,
  ListStudentsQueryParams,
  ListStudentsResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  RecordPaymentBody,
  RecordPaymentResponse,
  SaveAttendanceBody,
  SaveAttendanceResponse,
  GetOperationsResponse,
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";
import {
  announcements,
  attendance,
  assignments,
  classes,
  currentUserFromToken,
  currencyOptions,
  disciplineCases,
  documents,
  expenses,
  getDateLabel,
  getStudent,
  hashPassword,
  inventoryItems,
  libraryItems,
  makeSession,
  medicalRecords,
  nextRegistrationNumber,
  notifications,
  parents,
  payments,
  publicUser,
  reports,
  salaryPayments,
  sessionStore,
  schoolEvents,
  schoolSettings,
  staffRecords,
  students,
  subjects,
  timetable,
  transportRoutes,
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

const administratorRoles: SchoolRole[] = ["super_admin", "administrator"];
const assignedClassNames = (user: ReturnType<typeof currentUserFromToken>) =>
  user?.role === "teacher"
    ? classes.filter((item) => item.teacherId === user.id).map((item) => item.name)
    : [];

function isAdministrator(user: ReturnType<typeof currentUserFromToken>) {
  return !!user && administratorRoles.includes(user.role);
}

function canManageAttendance(user: ReturnType<typeof currentUserFromToken>) {
  return !!user && (administratorRoles.includes(user.role) || user.role === "teacher");
}

function roleActions(role: SchoolRole, studentId?: string) {
  if (role === "teacher") {
    return [
      { id: "attendance", label: "Record attendance", description: "Mark today's register for your assigned classes.", href: "/attendance", tone: "green" },
      { id: "assignments", label: "Manage assignments", description: "Create and follow up work for your classes.", href: "/operations?view=assignments", tone: "blue" },
      { id: "classes", label: "Open my classes", description: "See only the classes and subjects assigned to you.", href: "/operations?view=classes", tone: "violet" },
    ];
  }
  if (role === "accountant") {
    return [
      { id: "payment", label: "Record a payment", description: "Issue a receipt and update the learner balance.", href: "/finance", tone: "green" },
      { id: "expense", label: "Log an expense", description: "Capture school spending for approval and reporting.", href: "/operations?view=expenses", tone: "amber" },
      { id: "reports", label: "Open finance reports", description: "Review collection and expense summaries.", href: "/operations?view=reports", tone: "blue" },
    ];
  }
  if (role === "guardian") {
    const learnerPath = studentId ? `/students/${studentId}` : "/students";
    return [
      { id: "child", label: "View my child", description: "Open the linked learner profile and progress.", href: learnerPath, tone: "green" },
      { id: "fees", label: "Check school fees", description: "Review the current balance for your linked learner.", href: learnerPath, tone: "amber" },
      { id: "notices", label: "Read school notices", description: "Keep up with announcements for families.", href: "/announcements", tone: "blue" },
    ];
  }
  if (role === "student") {
    const learnerPath = studentId ? `/students/${studentId}` : "/students";
    return [
      { id: "assignments", label: "My assignments", description: "See work set for your class and due dates.", href: "/operations?view=assignments", tone: "blue" },
      { id: "results", label: "View report card", description: "Review your latest subjects, grades, and comment.", href: learnerPath, tone: "green" },
      { id: "timetable", label: "Open timetable", description: "Check your next lessons and rooms.", href: "/timetable", tone: "violet" },
    ];
  }
  if (role === "staff") {
    return [
      { id: "events", label: "View school events", description: "Know what is happening across the school.", href: "/operations?view=events", tone: "violet" },
      { id: "documents", label: "Open documents", description: "Find the policies and notices shared with staff.", href: "/operations?view=documents", tone: "blue" },
      { id: "notifications", label: "Check notifications", description: "Review the latest updates for your workday.", href: "/operations?view=notifications", tone: "green" },
    ];
  }
  return [
    { id: "register", label: "Register a pupil", description: "Create a permanent learner record and registration number.", href: "/students", tone: "green" },
    { id: "people", label: "Manage people", description: "Review pupils, guardians, and school staff.", href: "/operations?view=people", tone: "blue" },
    { id: "settings", label: "Configure school", description: "Set the academic year and school currency.", href: "/settings", tone: "violet" },
  ];
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

router.post("/users", async (req, res): Promise<void> => {
  const actor = requireUser(req);
  if (!isAdministrator(actor)) {
    res.status(403).json({ error: "Only administrators can create accounts." });
    return;
  }
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Complete the account name, identifier, role, and password." });
    return;
  }
  const data = parsed.data;
  if (users.some((item) => item.identifier.toLowerCase() === data.identifier.toLowerCase())) {
    res.status(409).json({ error: "That username or registration number is already in use." });
    return;
  }
  const linkedStudent = data.studentId
    ? students.find((item) => item.id === data.studentId || item.registrationNumber.toLowerCase() === data.studentId?.toLowerCase())
    : undefined;
  if ((data.role === "student" || data.role === "guardian") && !linkedStudent) {
    res.status(400).json({ error: "Link pupil and guardian accounts to a student record." });
    return;
  }
  if (data.studentId && !linkedStudent) {
    res.status(404).json({ error: "The linked pupil record was not found." });
    return;
  }
  const account = {
    id: `usr-${String(users.length + 1).padStart(3, "0")}`,
    name: data.name,
    identifier: data.identifier,
    password: hashPassword(data.password),
    userType: data.userType,
    role: data.role as SchoolRole,
    initials: data.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    schoolName: schoolSettings.schoolName,
    studentId: linkedStudent?.id,
  };
  users.push(account);
  if (account.userType === "staff") {
    staffRecords.push({
      id: account.id,
      name: account.name,
      role: account.role.replace("_", " "),
      username: account.identifier,
      phone: "Not provided",
      status: "Active",
    });
  }
  req.log.info({ accountId: account.id, role: account.role }, "School account created");
  res.status(201).json(CreateUserResponse.parse(publicUser(account)));
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const role: SchoolRole = user?.role ?? "administrator";
  const teacherClasses = assignedClassNames(user);
  const visibleStudents = user.studentId
    ? students.filter((student) => student.id === user.studentId)
    : role === "teacher"
      ? students.filter((student) => teacherClasses.includes(`${student.className} ${student.stream}`))
      : role === "accountant" || isAdministrator(user)
        ? students
        : [];
  const visibleAttendance = role === "teacher"
    ? attendance.filter((record) => teacherClasses.includes(record.className))
    : user.studentId
      ? attendance.filter((record) => record.studentId === user.studentId)
      : attendance;
  const presentCount = visibleAttendance.filter((record) => record.status === "present").length;
  const absentCount = visibleAttendance.filter((record) => record.status === "absent").length;
  const feeCollected = isAdministrator(user) || role === "accountant"
    ? payments.reduce((total, payment) => total + payment.amount, 0)
    : 0;
  const payload = {
    role,
    greeting: roleGreeting(user?.name ?? "Amara Njeri"),
    summary: {
      students: role === "student" || role === "guardian" ? visibleStudents.length : students.length,
      teachers: isAdministrator(user) || role === "accountant" ? 24 : role === "teacher" ? 1 : 0,
      staff: isAdministrator(user) ? 38 : 0,
      classes: isAdministrator(user) ? classes.length : role === "teacher" ? teacherClasses.length : user.studentId ? 1 : 0,
      attendance: visibleAttendance.length ? Math.round((presentCount / visibleAttendance.length) * 100) : 0,
      absent: absentCount,
      feesCollected: feeCollected,
      outstandingFees: isAdministrator(user) || role === "accountant"
        ? students.reduce((total, student) => total + student.feeBalance, 0)
        : visibleStudents.reduce((total, student) => total + student.feeBalance, 0),
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
     recentAdmissions: isAdministrator(user) ? students.slice(0, 4) : visibleStudents.slice(0, 4),
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
     assignedClasses: role === "teacher" ? teacherClasses : undefined,
     assignedSubjects: role === "teacher" ? subjects.filter((subject) => subject.teacherId === user.id).map((subject) => subject.name) : undefined,
    children: role === "guardian" ? visibleStudents : undefined,
    feeBalance: role === "guardian" || role === "student" ? visibleStudents[0]?.feeBalance ?? 0 : undefined,
    latestResult: role === "guardian" || role === "student" ? 82 : undefined,
     roleActions: roleActions(role, user.studentId),
     currencyCode: schoolSettings.currencyCode,
     currencySymbol: schoolSettings.currencySymbol,
  };

  res.json(GetDashboardResponse.parse(payload));
});

router.get("/students", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const parsed = ListStudentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid student filters." });
    return;
  }
  const search = parsed.data.search?.toLowerCase() ?? "";
  const teacherClasses = assignedClassNames(user);
  const visibleStudents = user.studentId
    ? students.filter((student) => student.id === user.studentId)
    : user.role === "teacher"
      ? students.filter((student) => teacherClasses.includes(`${student.className} ${student.stream}`))
      : isAdministrator(user) || user.role === "accountant"
        ? students
        : [];
  const result = visibleStudents.filter((student) => {
    const matchesSearch = !search || [student.name, student.registrationNumber, student.className, student.guardianName]
      .some((field) => field.toLowerCase().includes(search));
    const matchesClass = !parsed.data.className || student.className === parsed.data.className;
    const matchesStatus = !parsed.data.status || student.status === parsed.data.status;
    return matchesSearch && matchesClass && matchesStatus;
  });
  res.json(ListStudentsResponse.parse(result));
});

router.post("/students", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!isAdministrator(user)) {
    res.status(403).json({ error: "Only administrators can register pupils." });
    return;
  }
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
    enrollmentType: data.enrollmentType,
    termFee: data.termFee,
    amountPaid: data.initialPayment,
  };
  student.feeBalance = Math.max(0, data.termFee - data.initialPayment);
  students.unshift(student);
  if (data.initialPayment > 0) {
    payments.unshift({
      id: `pay-${String(payments.length + 1).padStart(3, "0")}`,
      receiptNumber: `RCPT-${new Date().getFullYear()}-${String(payments.length + 1).padStart(4, "0")}`,
      studentName: student.name,
      registrationNumber: student.registrationNumber,
      amount: data.initialPayment,
      method: data.paymentMethod || "Cash",
      date: getDateLabel(),
      status: "completed",
    });
  }
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
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const teacherClasses = assignedClassNames(user);
  if ((user?.role === "student" || user?.role === "guardian") && user.studentId !== student.id) {
    res.status(403).json({ error: "You do not have access to this pupil." });
    return;
  }
  if (user.role === "teacher" && !teacherClasses.includes(`${student.className} ${student.stream}`)) {
    res.status(403).json({ error: "You do not have access to this assigned class." });
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
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const parsed = GetAttendanceQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid attendance filters." });
    return;
  }
  const teacherClasses = assignedClassNames(user);
  const result = attendance.filter((record) =>
    (!parsed.data.date || record.date === parsed.data.date) &&
    (!parsed.data.className || record.className === parsed.data.className),
  ).filter((record) =>
    user.studentId ? record.studentId === user.studentId :
      user.role === "teacher" ? teacherClasses.includes(record.className) :
        isAdministrator(user) ? true : false,
  );
  res.json(GetAttendanceResponse.parse(result));
});

router.post("/attendance", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user || !canManageAttendance(user)) {
    res.status(403).json({ error: "Only administrators and assigned teachers can mark attendance." });
    return;
  }
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
  if (user.role === "teacher" && !assignedClassNames(user).includes(`${student.className} ${student.stream}`)) {
    res.status(403).json({ error: "Teachers can only mark their assigned classes." });
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

router.get("/finance/summary", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) {
    res.status(403).json({ error: "Finance access is limited to administrators and accountants." });
    return;
  }
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

router.get("/finance/payments", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) {
    res.status(403).json({ error: "Finance access is limited to administrators and accountants." });
    return;
  }
  res.json(ListPaymentsResponse.parse(payments));
});

router.post("/finance/payments", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) {
    res.status(403).json({ error: "Only administrators and accountants can record payments." });
    return;
  }
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
    receiptNumber: `RCPT-${new Date().getFullYear()}-${String(payments.length + 1).padStart(4, "0")}`,
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

router.get("/finance/expenses", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) {
    res.status(403).json({ error: "Only finance roles can view expenses." });
    return;
  }
  res.json(ListExpensesResponse.parse(expenses));
});

router.post("/finance/expenses", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) {
    res.status(403).json({ error: "Only finance roles can add expenses." });
    return;
  }
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a category, description, amount, date, and reference." });
    return;
  }
  const item = {
    id: `expense-${String(expenses.length + 1).padStart(3, "0")}`,
    category: parsed.data.category,
    description: parsed.data.description,
    amount: parsed.data.amount,
    date: parsed.data.date,
    status: isAdministrator(user) ? "Approved" : "Pending approval",
  };
  expenses.unshift(item);
  req.log.info({ expenseId: item.id, amount: item.amount }, "School expense added");
  res.status(201).json(CreateExpenseResponse.parse(item));
});

router.get("/finance/salaries", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) {
    res.status(403).json({ error: "Only finance roles can view salary payments." });
    return;
  }
  res.json(ListSalariesResponse.parse(salaryPayments));
});

router.post("/finance/salaries", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) {
    res.status(403).json({ error: "Only finance roles can pay salaries." });
    return;
  }
  const parsed = CreateSalaryPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a staff member, pay period, amount, method, and reference." });
    return;
  }
  const staff = staffRecords.find((item) => item.id === parsed.data.staffId) || users.find((item) => item.id === parsed.data.staffId);
  if (!staff) {
    res.status(404).json({ error: "Staff account not found." });
    return;
  }
  const item = {
    id: `salary-${String(salaryPayments.length + 1).padStart(3, "0")}`,
    staffName: staff.name,
    period: parsed.data.period,
    amount: parsed.data.amount,
    paymentDate: getDateLabel(),
    method: parsed.data.method,
    status: "Paid",
  };
  salaryPayments.unshift(item);
  req.log.info({ salaryPaymentId: item.id, staffId: staff.id, amount: item.amount }, "Salary payment recorded");
  res.status(201).json(CreateSalaryPaymentResponse.parse(item));
});

router.get("/announcements", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const visible = announcements.filter((item) => {
    if (isAdministrator(user) || user.role === "staff") return true;
    if (user.role === "teacher") return item.audience !== "Parents & guardians";
    if (user.role === "guardian") return item.audience === "Entire school" || item.audience === "Parents & guardians" || item.audience === "Everyone" || item.audience === "Guardians";
    if (user.role === "student") return item.audience === "Entire school" || item.audience === "Teachers & pupils" || item.audience === "Everyone" || item.audience === "Students";
    return false;
  });
  res.json(ListAnnouncementsResponse.parse(visible));
});

router.post("/announcements", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "teacher")) {
    res.status(403).json({ error: "Only administrators and teachers can publish announcements." });
    return;
  }
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
     author: user.name,
    priority: parsed.data.priority,
  };
  announcements.unshift(item);
  res.status(201).json(CreateAnnouncementResponse.parse(item));
});

router.get("/academics/timetable", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const teacherClasses = assignedClassNames(user);
  const linkedStudent = user.studentId ? getStudent(user.studentId) : undefined;
  const visible = user.role === "teacher"
    ? timetable.filter((entry) => teacherClasses.includes(entry.className) && entry.teacher === user.name)
    : linkedStudent
      ? timetable.filter((entry) => entry.className === `${linkedStudent.className} ${linkedStudent.stream}`)
      : isAdministrator(user) || user.role === "staff" || user.role === "accountant"
        ? timetable
        : [];
  res.json(GetTimetableResponse.parse(visible));
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
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  if (user.studentId && user.studentId !== student.id) {
    res.status(403).json({ error: "You do not have access to this report card." });
    return;
  }
  if (user.role === "teacher" && !assignedClassNames(user).includes(`${student.className} ${student.stream}`)) {
    res.status(403).json({ error: "You do not have access to this assigned class." });
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

router.get("/operations", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const teacherClassNames = assignedClassNames(user);
  const linkedStudent = user.studentId ? getStudent(user.studentId) : undefined;
  const linkedClassName = linkedStudent ? `${linkedStudent.className} ${linkedStudent.stream}` : undefined;
  const visibleClassNames = user.role === "teacher"
    ? teacherClassNames
    : linkedClassName
      ? [linkedClassName]
      : undefined;
  const visibleStudents = user.role === "teacher"
    ? students.filter((student) => teacherClassNames.includes(`${student.className} ${student.stream}`))
    : linkedStudent
      ? [linkedStudent]
      : students;
  const classRows = classes.filter((item) => !visibleClassNames || visibleClassNames.includes(item.name));
  const studentIds = new Set(visibleStudents.map((student) => student.id));
  const visibleDocuments = documents.filter((item) =>
    isAdministrator(user) || user.role === "accountant" || item.visibility === "Entire school" ||
    (user.role === "teacher" && item.visibility === "Staff only") ||
    ((user.role === "guardian" || user.role === "student") && item.visibility === "Guardians & staff"),
  );
  const modules = {
    classes: classRows,
    assignments: assignments.filter((item) => !visibleClassNames || visibleClassNames.includes(item.className)),
    staff: isAdministrator(user) ? staffRecords : [],
    parents: isAdministrator(user) ? parents : [],
    expenses: isAdministrator(user) || user.role === "accountant" ? expenses : [],
    salaries: isAdministrator(user) || user.role === "accountant" ? salaryPayments : [],
    discipline: disciplineCases.filter((item) => studentIds.has(item.studentId)),
    medical: medicalRecords.filter((item) => studentIds.has(item.studentId)),
    library: libraryItems,
    transport: transportRoutes,
    inventory: isAdministrator(user) || user.role === "staff" ? inventoryItems : [],
    events: schoolEvents,
    documents: visibleDocuments,
    reports: isAdministrator(user) || user.role === "accountant"
      ? reports
      : reports.filter((item) => item.id === "report-001"),
    notifications,
  };
  res.json(GetOperationsResponse.parse({
    role: user.role,
    currencyCode: schoolSettings.currencyCode,
    currencyName: schoolSettings.currencyName,
    currencySymbol: schoolSettings.currencySymbol,
    actions: roleActions(user.role, user.studentId),
    modules,
  }));
});

router.get("/settings", async (req, res): Promise<void> => {
  if (!requireUser(req)) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(GetSettingsResponse.parse({ ...schoolSettings, availableCurrencies: currencyOptions }));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const user = requireUser(req);
  if (!isAdministrator(user)) {
    res.status(403).json({ error: "Only administrators can update school settings." });
    return;
  }
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid school currency and settings." });
    return;
  }
  const selectedCurrency = parsed.data.currencyCode
    ? currencyOptions.find((currency) => currency.code === parsed.data.currencyCode)
    : currencyOptions.find((currency) => currency.code === schoolSettings.currencyCode);
  if (!selectedCurrency) {
    res.status(400).json({ error: "That currency is not available." });
    return;
  }
  if (parsed.data.schoolName !== undefined) schoolSettings.schoolName = parsed.data.schoolName;
  if (parsed.data.academicYear !== undefined) schoolSettings.academicYear = parsed.data.academicYear;
  schoolSettings.currencyCode = selectedCurrency.code;
  schoolSettings.currencyName = selectedCurrency.name;
  schoolSettings.currencySymbol = selectedCurrency.symbol;
  req.log.info({ currencyCode: schoolSettings.currencyCode }, "School settings updated");
  res.json(UpdateSettingsResponse.parse({ ...schoolSettings, availableCurrencies: currencyOptions }));
});

export default router;