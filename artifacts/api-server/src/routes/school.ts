import { Router, type IRouter } from "express";
import {
  AttendanceRecord, CreateAnnouncementBody, CreateAnnouncementResponse, CreateAttendanceRegisterBody, CreateAttendanceRegisterResponse, CreateExpenseBody, CreateExpenseResponse,
  CreateSalaryPaymentBody, CreateSalaryPaymentResponse, CreateStudentBody, CreateStudentResponse, CreateUserBody,
  CreateUserResponse, GetAttendanceQueryParams, GetAttendanceResponse, GetCurrentUserResponse, GetDashboardResponse,
  GetFinanceSummaryResponse, GetOperationsResponse, GetReportCardParams, GetReportCardResponse, GetStudentParams,
  GetStudentResponse, GetTimetableResponse, CreateTimetableEntryBody, CreateTimetableEntryResponse, ListAnnouncementsResponse, ListExpensesResponse, ListPaymentsResponse,
  ListSalariesResponse, ListStudentsQueryParams, ListStudentsResponse, LoginBody, LoginResponse, LogoutResponse,
  RecordPaymentBody, RecordPaymentResponse, SaveAttendanceBody, SaveAttendanceResponse, GetSettingsResponse,
  UpdateCurrentUserBody, UpdateCurrentUserResponse, UpdateSettingsBody, UpdateSettingsResponse,
} from "@workspace/api-zod";
import {
  AttendanceStatus, consumeLoginAttempt, currencyOptions, createAttendanceRegister, createOperation, createStudentWithPayment, createUser, currentUserFromToken,
  clearLoginFailures, deleteSession, findUser, getSchoolSettings, getStudent, getDateLabel, hashPassword, initializeSchoolData,
  listAttendance, listOperation, listPayments, listStudents, makeSession, publicUser, recordPayment, saveAttendance,
  updateSchoolSettings, updateStudentBalance, updateUserProfile, verifyPassword, type OperationKind, type OperationRecord, type SchoolRole, type SchoolUser,
} from "../lib/school-data";

const router: IRouter = Router();
const getCookie = (req: Parameters<Parameters<IRouter["get"]>[1]>[0], name: string) =>
  req.headers.cookie?.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
const setSessionCookie = (res: Parameters<Parameters<IRouter["get"]>[1]>[1], token: string) =>
  res.setHeader("Set-Cookie", `schoolops_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800${process.env["NODE_ENV"] === "production" ? "; Secure" : ""}`);
const requireUser = (req: Parameters<Parameters<IRouter["get"]>[1]>[0]) => currentUserFromToken(getCookie(req, "schoolops_session"));
const administratorRoles: SchoolRole[] = ["super_admin", "administrator"];
const isAdministrator = (user?: SchoolUser) => !!user && administratorRoles.includes(user.role);
const roleGreeting = (name: string) => `Good morning, ${name.split(" ")[0]}`;
const roleActions = (role: SchoolRole, studentId?: string) => role === "teacher"
  ? [{ id: "attendance", label: "Record attendance", description: "Mark today's register for your assigned classes.", href: "/attendance", tone: "green" }, { id: "assignments", label: "Manage assignments", description: "Create and follow up work for your classes.", href: "/operations?view=assignments", tone: "blue" }, { id: "classes", label: "Open my classes", description: "See only the classes and subjects assigned to you.", href: "/operations?view=classes", tone: "violet" }]
  : role === "accountant"
    ? [{ id: "payment", label: "Record a payment", description: "Issue a receipt and update the learner balance.", href: "/finance", tone: "green" }, { id: "expense", label: "Log an expense", description: "Capture school spending for approval and reporting.", href: "/operations?view=expenses", tone: "amber" }, { id: "reports", label: "Open finance reports", description: "Review collection and expense summaries.", href: "/operations?view=reports", tone: "blue" }]
    : role === "guardian" || role === "student"
      ? [{ id: "child", label: "View my child", description: "Open the linked learner profile and progress.", href: studentId ? `/students/${studentId}` : "/students", tone: "green" }, { id: "fees", label: "Check school fees", description: "Review the current balance for your linked learner.", href: studentId ? `/students/${studentId}` : "/students", tone: "amber" }, { id: "notices", label: "Read school notices", description: "Keep up with school notices.", href: "/announcements", tone: "blue" }]
      : [{ id: "register", label: "Register a pupil", description: "Create a permanent learner record and registration number.", href: "/students", tone: "green" }, { id: "people", label: "Manage people", description: "Review pupils, guardians, and school staff.", href: "/operations?view=people", tone: "blue" }, { id: "settings", label: "Configure school", description: "Set the academic year and school currency.", href: "/settings", tone: "violet" }];
async function assignedClassNames(user?: SchoolUser) {
  if (user?.role !== "teacher") return [];
  const rows = await listOperation("classes");
  return rows.filter((item) => item.teacherId === user.id).map((item) => String(item.name));
}
const errorResponse = (res: Parameters<Parameters<IRouter["get"]>[1]>[1], status: number, error: string) => res.status(status).json({ error });

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Enter your login details to continue."); return; }
  const clientAddress = req.ip || "unknown";
  const attemptKey = `${clientAddress}:${parsed.data.identifier.toLowerCase()}:${parsed.data.userType}`;
  if (!await consumeLoginAttempt(attemptKey)) {
    errorResponse(res, 429, "Too many sign-in attempts. Try again in 15 minutes.");
    return;
  }
  const user = await findUser(parsed.data.identifier, parsed.data.userType);
  if (!user || !verifyPassword(parsed.data.password, user.password)) {
    errorResponse(res, 401, "Those details do not match an active account.");
    return;
  }
  await clearLoginFailures(attemptKey);
  const token = await makeSession(user.id);
  setSessionCookie(res, token);
  res.json(LoginResponse.parse({ user: publicUser(user), expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() }));
});
router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = getCookie(req, "schoolops_session");
  if (token) await deleteSession(token);
  res.setHeader("Set-Cookie", `schoolops_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env["NODE_ENV"] === "production" ? "; Secure" : ""}`);
  res.json(LogoutResponse.parse({ message: "Signed out successfully." }));
});
router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  res.json(GetCurrentUserResponse.parse({ user: publicUser(user), expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() }));
});
router.patch("/auth/me", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const parsed = UpdateCurrentUserBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Enter valid profile details."); return; }
  if (parsed.data.newPassword && (!parsed.data.currentPassword || !verifyPassword(parsed.data.currentPassword, user.password))) {
    errorResponse(res, 400, "Your current password is incorrect.");
    return;
  }
  if (parsed.data.identifier && parsed.data.identifier.toLowerCase() !== user.identifier.toLowerCase()) {
    const existing = await findUser(parsed.data.identifier, user.userType);
    if (existing) { errorResponse(res, 409, "That username is already in use."); return; }
  }
  try {
    const updated = await updateUserProfile(user, parsed.data);
    res.json(UpdateCurrentUserResponse.parse({ user: publicUser(updated), expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() }));
  } catch {
    errorResponse(res, 409, "The profile could not be updated. Check the username and try again.");
  }
});

router.post("/users", async (req, res): Promise<void> => {
  const actor = await requireUser(req);
  if (!isAdministrator(actor)) { errorResponse(res, 403, "Only administrators can create accounts."); return; }
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Complete the account name, identifier, role, and password."); return; }
  const existing = await findUser(parsed.data.identifier, parsed.data.userType);
  if (existing) { errorResponse(res, 409, "That username or registration number is already in use."); return; }
  let studentId: string | undefined;
  if (parsed.data.studentId) {
    const linked = await getStudent(parsed.data.studentId);
    if (!linked) { errorResponse(res, 404, "The linked pupil record was not found."); return; }
    studentId = linked.id;
  }
  if ((parsed.data.role === "student" || parsed.data.role === "guardian") && !studentId) { errorResponse(res, 400, "Link pupil and guardian accounts to a student record."); return; }
  try {
    const account = await createUser({ ...parsed.data, role: parsed.data.role as SchoolRole, studentId });
    res.status(201).json(CreateUserResponse.parse(publicUser(account)));
  } catch { errorResponse(res, 409, "That username or registration number is already in use."); }
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const [allStudents, allAttendance, allPayments, settings, classesRows, subjectsRows, teacherClasses] = await Promise.all([
    listStudents(), listAttendance(), listPayments(), getSchoolSettings(), listOperation("classes"), listOperation("subjects"), assignedClassNames(user),
  ]);
  const visibleStudents = user.studentId ? allStudents.filter((item) => item.id === user.studentId) : user.role === "teacher" ? allStudents.filter((item) => teacherClasses.includes(`${item.className} ${item.stream}`)) : allStudents;
  const visibleAttendance = user.studentId ? allAttendance.filter((item) => item.studentId === user.studentId) : user.role === "teacher" ? allAttendance.filter((item) => teacherClasses.includes(item.className)) : allAttendance;
  const present = visibleAttendance.filter((item) => item.status === "present").length;
  const payload = {
    role: user.role, greeting: roleGreeting(user.name),
    summary: { students: visibleStudents.length, teachers: classesRows.length, staff: 0, classes: classesRows.length, attendance: visibleAttendance.length ? Math.round((present / visibleAttendance.length) * 100) : 0, absent: visibleAttendance.filter((item) => item.status === "absent").length, feesCollected: isAdministrator(user) || user.role === "accountant" ? allPayments.reduce((sum, item) => sum + item.amount, 0) : 0, outstandingFees: visibleStudents.reduce((sum, item) => sum + item.feeBalance, 0) },
    attendanceTrend: [], performance: [], recentAdmissions: visibleStudents.slice(0, 4), upcomingEvents: [], quickActions: ["Register pupil", "Take attendance", "Send announcement", "View reports"],
    assignedClasses: user.role === "teacher" ? teacherClasses : undefined, assignedSubjects: user.role === "teacher" ? subjectsRows.filter((item) => item.teacherId === user.id).map((item) => String(item.name)) : undefined,
    children: user.role === "guardian" ? visibleStudents : undefined, feeBalance: user.role === "guardian" || user.role === "student" ? visibleStudents[0]?.feeBalance ?? 0 : undefined, latestResult: user.role === "guardian" || user.role === "student" ? 0 : undefined,
    roleActions: roleActions(user.role, user.studentId), currencyCode: settings.currencyCode, currencySymbol: settings.currencySymbol,
  };
  res.json(GetDashboardResponse.parse(payload));
});

router.get("/students", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const parsed = ListStudentsQueryParams.safeParse(req.query);
  if (!parsed.success) { errorResponse(res, 400, "Invalid student filters."); return; }
  const rows = await listStudents();
  const classesForTeacher = await assignedClassNames(user);
  const visible = user.studentId ? rows.filter((item) => item.id === user.studentId) : user.role === "teacher" ? rows.filter((item) => classesForTeacher.includes(`${item.className} ${item.stream}`)) : isAdministrator(user) || user.role === "accountant" ? rows : [];
  const search = parsed.data.search?.toLowerCase() ?? "";
  res.json(ListStudentsResponse.parse(visible.filter((item) => (!search || [item.name, item.registrationNumber, item.className, item.guardianName].some((field) => field.toLowerCase().includes(search))) && (!parsed.data.className || item.className === parsed.data.className) && (!parsed.data.status || item.status === parsed.data.status))));
});
router.post("/students", async (req, res): Promise<void> => {
  if (!isAdministrator(await requireUser(req))) { errorResponse(res, 403, "Only administrators can register pupils."); return; }
  // Opening payment is optional at runtime for registrations created by API clients
  // that omit it, while the generated client continues to support its legacy field.
  const parsed = CreateStudentBody.safeParse({ ...req.body, initialPayment: req.body?.initialPayment ?? 0 });
  if (!parsed.success) { errorResponse(res, 400, "Complete the required pupil and guardian fields."); return; }
  try {
    const created = await createStudentWithPayment(parsed.data);
    const result = { ...created.student, ...(created.payment ? { receiptNumber: created.payment.receiptNumber } : {}) };
    res.status(201).json(CreateStudentResponse.parse(result));
  } catch { errorResponse(res, 409, "A pupil could not be registered. Please try again."); }
});
router.get("/students/:studentId", async (req, res): Promise<void> => {
  const parsed = GetStudentParams.safeParse(req.params);
  if (!parsed.success) { errorResponse(res, 400, "Invalid student id."); return; }
  const student = await getStudent(parsed.data.studentId);
  const user = await requireUser(req);
  if (!student) { errorResponse(res, 404, "Student not found"); return; }
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  if (!isAdministrator(user) && user.role !== "teacher" && user.studentId !== student.id) { errorResponse(res, 403, "You do not have access to this pupil."); return; }
  const assigned = await assignedClassNames(user);
  if ((user.role === "student" || user.role === "guardian") && user.studentId !== student.id) { errorResponse(res, 403, "You do not have access to this pupil."); return; }
  if (user.role === "teacher" && !assigned.includes(`${student.className} ${student.stream}`)) { errorResponse(res, 403, "You do not have access to this assigned class."); return; }
  res.json(GetStudentResponse.parse({ ...student, academicHistory: [] }));
});

router.get("/attendance", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const parsed = GetAttendanceQueryParams.safeParse(req.query);
  if (!parsed.success) { errorResponse(res, 400, "Invalid attendance filters."); return; }
  const assigned = await assignedClassNames(user);
  const records = await listAttendance();
  const visible = records.filter((record) => (!parsed.data.date || record.date === parsed.data.date) && (!parsed.data.className || record.className === parsed.data.className || record.className.startsWith(`${parsed.data.className} `)) && (user.studentId ? record.studentId === user.studentId : user.role === "teacher" ? assigned.includes(record.className) : isAdministrator(user)));
  res.json(GetAttendanceResponse.parse(visible));
});
router.post("/attendance", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "teacher")) { errorResponse(res, 403, "Only administrators and assigned teachers can mark attendance."); return; }
  const parsed = SaveAttendanceBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Choose a pupil, date, and attendance status."); return; }
  const student = await getStudent(parsed.data.studentId);
  if (!student) { errorResponse(res, 404, "Student not found"); return; }
  if (user.role === "teacher" && !(await assignedClassNames(user)).includes(`${student.className} ${student.stream}`)) { errorResponse(res, 403, "Teachers can only mark their assigned classes."); return; }
  const record = await saveAttendance(student.id, parsed.data.date, parsed.data.status as AttendanceStatus);
  res.json(SaveAttendanceResponse.parse(record));
});
router.post("/attendance/create", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "teacher")) { errorResponse(res, 403, "Only administrators and teachers can create attendance registers."); return; }
  const parsed = CreateAttendanceRegisterBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Choose a class and date for the attendance register."); return; }
  if (user.role === "teacher" && !(await assignedClassNames(user)).some((assignedClass) => assignedClass === parsed.data.className || assignedClass.startsWith(`${parsed.data.className} `))) { errorResponse(res, 403, "Teachers can only create registers for assigned classes."); return; }
  const records = await createAttendanceRegister(parsed.data.className, parsed.data.date);
  res.status(201).json(CreateAttendanceRegisterResponse.parse(records));
});

router.get("/finance/summary", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) { errorResponse(res, 403, "Finance access is limited to administrators and accountants."); return; }
  const [rows, studentsRows] = await Promise.all([listPayments(), listStudents()]);
  const collected = rows.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.amount, 0);
  const outstanding = studentsRows.reduce((sum, item) => sum + item.feeBalance, 0);
  res.json(GetFinanceSummaryResponse.parse({ collected, outstanding, collectionRate: collected + outstanding ? Math.round((collected / (collected + outstanding)) * 100) : 0, trend: 0, monthly: [] }));
});
router.get("/finance/payments", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) { errorResponse(res, 403, "Finance access is limited to administrators and accountants."); return; }
  res.json(ListPaymentsResponse.parse(await listPayments()));
});
router.post("/finance/payments", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) { errorResponse(res, 403, "Only administrators and accountants can record payments."); return; }
  const parsed = RecordPaymentBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Enter a valid student, amount, method, and reference."); return; }
  try {
    const payment = await recordPayment(parsed.data.studentId, parsed.data.amount, parsed.data.method, parsed.data.reference);
    if (!payment) { errorResponse(res, 404, "Student not found"); return; }
    res.status(201).json(RecordPaymentResponse.parse(payment));
  } catch {
    errorResponse(res, 409, "The payment exceeds the pupil’s current fee balance.");
  }
});

router.get("/finance/expenses", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) { errorResponse(res, 403, "Only finance roles can view expenses."); return; }
  res.json(ListExpensesResponse.parse(await listOperation("expenses")));
});
router.post("/finance/expenses", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) { errorResponse(res, 403, "Only finance roles can add expenses."); return; }
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Enter a category, description, amount, date, and reference."); return; }
  const item = await createOperation("expenses", { ...parsed.data, status: isAdministrator(user) ? "Approved" : "Pending approval" });
  res.status(201).json(CreateExpenseResponse.parse(item));
});
router.get("/finance/salaries", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) { errorResponse(res, 403, "Only finance roles can view salary payments."); return; }
  res.json(ListSalariesResponse.parse(await listOperation("salaryPayments")));
});
router.post("/finance/salaries", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) { errorResponse(res, 403, "Only finance roles can pay salaries."); return; }
  const parsed = CreateSalaryPaymentBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Choose a staff member, pay period, amount, method, and reference."); return; }
  const staff = (await listOperation("staff")).find((item) => item.id === parsed.data.staffId) || (await findUserByIdCompat(parsed.data.staffId));
  if (!staff) { errorResponse(res, 404, "Staff account not found."); return; }
  const item = await createOperation("salaryPayments", { ...parsed.data, staffName: String(staff.name), paymentDate: getDateLabel(), status: "Paid" });
  res.status(201).json(CreateSalaryPaymentResponse.parse(item));
});
async function findUserByIdCompat(id: string) { const students = await listStudents(); return students.find((item) => item.id === id) as unknown as { name: string } | undefined; }

router.get("/announcements", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const rows = await listOperation("announcements");
  const visible = rows.filter((item) => isAdministrator(user) || user.role === "staff" || (user.role === "teacher" && item.audience !== "Parents & guardians") || (user.role === "guardian" && ["Entire school", "Parents & guardians", "Everyone", "Guardians"].includes(String(item.audience))) || (user.role === "student" && ["Entire school", "Teachers & pupils", "Everyone", "Students"].includes(String(item.audience))));
  res.json(ListAnnouncementsResponse.parse(visible));
});
router.post("/announcements", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "teacher")) { errorResponse(res, 403, "Only administrators and teachers can publish announcements."); return; }
  const parsed = CreateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Add a title and message before publishing."); return; }
  const item = await createOperation("announcements", { ...parsed.data, publishedAt: getDateLabel(), author: user.name });
  res.status(201).json(CreateAnnouncementResponse.parse(item));
});

router.get("/academics/timetable", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const rows = await listOperation("timetable");
  const student = user.studentId ? await getStudent(user.studentId) : undefined;
  const assigned = await assignedClassNames(user);
  const visible = user.role === "teacher" ? rows.filter((item) => assigned.includes(String(item.className)) && item.teacher === user.name) : student ? rows.filter((item) => item.className === `${student.className} ${student.stream}`) : isAdministrator(user) || user.role === "staff" || user.role === "accountant" ? rows : [];
  res.json(GetTimetableResponse.parse(visible));
});
router.post("/academics/timetable", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!isAdministrator(user)) { errorResponse(res, 403, "Only administrators can create timetable entries."); return; }
  const parsed = CreateTimetableEntryBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Complete the day, time, subject, teacher, class, and room."); return; }
  const item = await createOperation("timetable", { ...parsed.data, accent: parsed.data.accent || "hsl(var(--primary))" });
  res.status(201).json(CreateTimetableEntryResponse.parse(item));
});
router.get("/academics/report-cards/:studentId", async (req, res): Promise<void> => {
  const parsed = GetReportCardParams.safeParse(req.params);
  const user = await requireUser(req);
  if (!parsed.success) { errorResponse(res, 400, "Invalid student id."); return; }
  const student = await getStudent(parsed.data.studentId);
  if (!student) { errorResponse(res, 404, "Student not found"); return; }
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  if (!isAdministrator(user) && user.role !== "teacher" && user.studentId !== student.id) { errorResponse(res, 403, "You do not have access to this report card."); return; }
  if (user.studentId && user.studentId !== student.id) { errorResponse(res, 403, "You do not have access to this report card."); return; }
  if (user.role === "teacher" && !(await assignedClassNames(user)).includes(`${student.className} ${student.stream}`)) { errorResponse(res, 403, "You do not have access to this assigned class."); return; }
  res.json(GetReportCardResponse.parse({ student, term: "Term 3", academicYear: (await getSchoolSettings()).academicYear, overallAverage: 0, overallGrade: "N/A", position: 0, teacherComment: "", subjects: [] }));
});

router.get("/operations", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const settings = await getSchoolSettings();
  const kinds: OperationKind[] = ["classes", "assignments", "staff", "parents", "expenses", "salaryPayments", "discipline", "medical", "library", "transport", "inventory", "events", "documents", "reports", "notifications"];
  const loaded = await Promise.all(kinds.map(async (kind) => [kind, await listOperation(kind)] as const));
  const data = Object.fromEntries(loaded) as Record<OperationKind, OperationRecord[]>;
  const students = await listStudents();
  const assigned = await assignedClassNames(user);
  const linked = user.studentId
    ? students.filter((item) => item.id === user.studentId)
    : user.role === "teacher"
      ? students.filter((item) => assigned.includes(`${item.className} ${item.stream}`))
      : isAdministrator(user)
        ? students
        : [];
  const visibleClasses = user.role === "teacher" ? data.classes.filter((item) => assigned.includes(String(item.name))) : data.classes;
  const studentIds = new Set(linked.map((item) => item.id));
  const linkedClasses = new Set(linked.map((item) => `${item.className} ${item.stream}`));
  const documentRows = data.documents.map((item) => {
    const pupil = students.find((student) => student.id === item.studentId);
    return pupil ? { ...item, pupilName: pupil.name, registrationNumber: pupil.registrationNumber } : item;
  });
  const modules = {
    classes: visibleClasses, assignments: isAdministrator(user) ? data.assignments : data.assignments.filter((item) => linkedClasses.has(String(item.className))),
    staff: isAdministrator(user) ? data.staff : [], parents: isAdministrator(user) ? data.parents : [],
    expenses: isAdministrator(user) || user.role === "accountant" ? data.expenses : [], salaries: isAdministrator(user) || user.role === "accountant" ? data.salaryPayments : [],
    discipline: data.discipline.filter((item) => studentIds.has(String(item.studentId))), medical: data.medical.filter((item) => studentIds.has(String(item.studentId))),
    library: data.library, transport: data.transport, inventory: isAdministrator(user) || user.role === "staff" ? data.inventory : [], events: data.events,
    documents: isAdministrator(user) || user.role === "staff" ? documentRows : [], reports: isAdministrator(user) || user.role === "accountant" ? data.reports : [], notifications: data.notifications,
  };
  res.json(GetOperationsResponse.parse({ role: user.role, currencyCode: settings.currencyCode, currencyName: settings.currencyName, currencySymbol: settings.currencySymbol, actions: roleActions(user.role, user.studentId), modules }));
});
router.get("/settings", async (req, res): Promise<void> => {
  if (!await requireUser(req)) { errorResponse(res, 401, "Not signed in"); return; }
  const settings = await getSchoolSettings();
  res.json(GetSettingsResponse.parse({ ...settings, availableCurrencies: currencyOptions }));
});
router.patch("/settings", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!isAdministrator(user)) { errorResponse(res, 403, "Only administrators can update school settings."); return; }
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Choose a valid school currency and settings."); return; }
  const current = await getSchoolSettings();
  const selected = currencyOptions.find((item) => item.code === (parsed.data.currencyCode ?? current.currencyCode));
  if (!selected) { errorResponse(res, 400, "That currency is not available."); return; }
  const settings = await updateSchoolSettings({ schoolName: parsed.data.schoolName, academicYear: parsed.data.academicYear, currencyCode: selected.code, currencyName: selected.name, currencySymbol: selected.symbol });
  res.json(UpdateSettingsResponse.parse({ ...settings, availableCurrencies: currencyOptions }));
});

export default router;