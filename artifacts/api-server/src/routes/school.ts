import { Router, type IRouter } from "express";
import {
  AttendanceRecord, CreateAnnouncementBody, CreateAnnouncementResponse, CreateAttendanceRegisterBody, CreateAttendanceRegisterResponse, CreateClassBody, CreateExpenseBody, CreateExpenseResponse,
  CreateSalaryPaymentBody, CreateSalaryPaymentResponse, CreateStudentBody, CreateStudentResponse,
  CreateClassResponse, GetAttendanceQueryParams, GetAttendanceResponse, GetCurrentUserResponse, GetDashboardResponse,
  GetAdmissionFormResponse, GetFinanceSummaryResponse, GetOperationsResponse, GetReportCardParams, GetReportCardResponse, CreateReportCardBody, CreateReportCardResponse, GetStudentParams,
  GetStudentResponse, GetTimetableResponse, CreateTimetableEntryBody, CreateTimetableEntryResponse, ListAnnouncementsResponse, ListExpensesResponse, ListPaymentsResponse,
  ListSalariesResponse, ListStudentsQueryParams, ListStudentsResponse, LoginBody, LoginResponse, LogoutResponse,
  RecordPaymentBody, RecordPaymentResponse, UpdatePaymentBody, UpdatePaymentResponse, SaveAttendanceBody, SaveAttendanceResponse, DeleteAttendanceRegisterBody, DeleteAttendanceRegisterResponse, GetDeletedAttendanceRegistersResponse, GetSettingsResponse,
  UpdateCurrentUserBody, UpdateCurrentUserResponse, UpdateSettingsBody, UpdateSettingsResponse, UpdateStudentBody, UpdateStudentResponse,
  CreateUserBody, CreateUserResponse, ListUsersResponse, UpdateUserProfileByAdminBody, UpdateUserProfileByAdminResponse,
  UpdateUserPermissionsBody, UpdateUserPermissionsResponse, DeleteUserResponse,
  ListSubjectsResponse, CreateSubjectBody, CreateSubjectResponse, UpdateSubjectParams, UpdateSubjectBody, UpdateSubjectResponse,
  DeleteSubjectParams, DeleteSubjectResponse,
} from "@workspace/api-zod";
import {
  AttendanceStatus, classAssignmentKey, consumeLoginAttempt, currencyOptions, createAttendanceRegister, createClass, createOperation, createStudentWithPayment, currentUserFromToken, getAdmissionForm,
  clearLoginFailures, deleteSession, findUser, findUserById, getSchoolSettings, getStudent, getDateLabel, hashPassword, initializeSchoolData,
  listAttendance, listDeletedAttendanceRegisters, listOperation, listPayments, listSalaryPayments, listSalaryStaff, listStudents, listUsers, makeSession, publicUser, recordPayment, recordSalaryPayment, saveAttendance, deleteAttendanceRegister, updateStudent,
  createUser, deleteOperation, deleteUser, updatePayment, updateOperation, updateSchoolSettings, updateStudentBalance, updateUserAdmin, updateUserProfile, verifyPassword, type OperationKind, type OperationRecord, type PermissionKey, type SchoolRole, type SchoolUser,
} from "../lib/school-data";

const router: IRouter = Router();
const getCookie = (req: Parameters<Parameters<IRouter["get"]>[1]>[0], name: string) =>
  req.headers.cookie?.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
const setSessionCookie = (res: Parameters<Parameters<IRouter["get"]>[1]>[1], token: string) =>
  res.setHeader("Set-Cookie", `schoolops_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800${process.env["NODE_ENV"] === "production" ? "; Secure" : ""}`);
const requireUser = (req: Parameters<Parameters<IRouter["get"]>[1]>[0]) => currentUserFromToken(getCookie(req, "schoolops_session"));
const administratorRoles: SchoolRole[] = ["super_admin", "administrator"];
const isAdministrator = (user?: SchoolUser) => !!user && administratorRoles.includes(user.role);
const hasPermission = (user: SchoolUser | undefined, permission: PermissionKey) => !!user && (isAdministrator(user) || user.permissions.includes(permission));
const canManageUsers = (user?: SchoolUser) => !!user && (user.role === "super_admin" || user.role === "administrator" || user.permissions.includes("users_manage"));
const canViewUsers = (user?: SchoolUser) => !!user && (canManageUsers(user) || user.permissions.includes("users_view"));
const canManageSubjects = (user?: SchoolUser) => !!user && (isAdministrator(user) || user.role === "teacher" || user.permissions.includes("subjects_manage"));
const canDeleteSubjects = (user?: SchoolUser) => !!user && (isAdministrator(user) || user.permissions.includes("subjects_delete"));
const recordAccountAudit = async (actor: SchoolUser, action: string, targetId: string, details: Record<string, unknown> = {}) => {
  await createOperation("documents", {
    type: "audit", category: "user_account", title: `Account ${action}`, description: `${actor.name} ${action} account ${targetId}`,
    actorId: actor.id, targetId, action, details, occurredAt: new Date().toISOString(), visibility: "administrator",
  });
};
const roleGreeting = (name: string) => `Good morning, ${name.split(" ")[0]}`;
const roleActions = (role: SchoolRole, studentId?: string) => role === "teacher"
  ? [{ id: "attendance", label: "Record attendance", description: "Mark today's register for your assigned classes.", href: "/attendance", tone: "green" }, { id: "assignments", label: "Manage assignments", description: "Create and follow up work for your classes.", href: "/operations?view=assignments", tone: "blue" }, { id: "classes", label: "Open my classes", description: "See only the classes and subjects assigned to you.", href: "/operations?view=classes", tone: "violet" }]
  : role === "accountant"
    ? [{ id: "payment", label: "Record a payment", description: "Issue a receipt and update the learner balance.", href: "/finance", tone: "green" }, { id: "expense", label: "Log an expense", description: "Capture school spending for approval and reporting.", href: "/expenses", tone: "amber" }, { id: "reports", label: "Open finance reports", description: "Review collection and expense summaries.", href: "/operations?view=reports", tone: "blue" }]
    : role === "guardian" || role === "student"
      ? [{ id: "child", label: "View my child", description: "Open the linked learner profile and progress.", href: studentId ? `/students/${studentId}` : "/students", tone: "green" }, { id: "fees", label: "Check school fees", description: "Review the current balance for your linked learner.", href: studentId ? `/students/${studentId}` : "/students", tone: "amber" }, { id: "notices", label: "Read school notices", description: "Keep up with school notices.", href: "/announcements", tone: "blue" }]
        : [{ id: "register", label: "Register a pupil", description: "Create a permanent learner record and registration number.", href: "/students", tone: "green" }, { id: "settings", label: "Configure school", description: "Set the academic year and school currency.", href: "/settings", tone: "violet" }];
const gradeForPercentage = (percentage: number) => percentage >= 80 ? "A" : percentage >= 70 ? "B" : percentage >= 60 ? "C" : percentage >= 50 ? "D" : "E";
const numberValue = (value: unknown) => typeof value === "number" ? value : Number(value || 0);
const reportCardFor = (student: NonNullable<Awaited<ReturnType<typeof getStudent>>>, saved: OperationRecord | undefined, reports: OperationRecord[]) => {
  const rawSubjects = Array.isArray(saved?.subjects) ? saved.subjects as Array<Record<string, unknown>> : [];
  const subjects = rawSubjects.map((item) => {
    const beginning = numberValue(item.beginning);
    const midterm = numberValue(item.midterm);
    const tests = numberValue(item.tests);
    const endOfTerm = numberValue(item.endOfTerm);
    const score = beginning + midterm + tests + endOfTerm;
    const percentage = Math.round((score / 4) * 100) / 100;
    return { subject: String(item.subject || ""), beginning, midterm, tests, endOfTerm, score, max: 400, percentage, position: 0, grade: gradeForPercentage(percentage), comment: String(item.comment || "") };
  });
  const overallAverage = subjects.length ? Math.round(subjects.reduce((sum, item) => sum + item.percentage, 0) / subjects.length * 100) / 100 : 0;
  const sameClass = reports.filter((item) => item.id !== saved?.id && item.className === student.className && item.stream === student.stream && item.term === saved?.term && item.academicYear === saved?.academicYear && typeof item.overallAverage === "number");
  const position = 1 + sameClass.filter((item) => numberValue(item.overallAverage) > overallAverage).length;
  return { student, term: String(saved?.term || "Term 3"), academicYear: String(saved?.academicYear || ""), overallAverage, overallGrade: overallAverage ? gradeForPercentage(overallAverage) : "N/A", position, teacherComment: String(saved?.teacherComment || ""), subjects };
};
async function assignedClassNames(user?: SchoolUser) {
  if (user?.role !== "teacher") return [];
  const rows = await listOperation("classes");
  return rows.filter((item) => item.teacherId === user.id).map((item) => classAssignmentKey(String(item.name), String(item.stream ?? "")));
}
const errorResponse = (res: Parameters<Parameters<IRouter["get"]>[1]>[1], status: number, error: string) => res.status(status).json({ error });
const matchesAssignedClass = (assigned: string[], className: string, stream?: string) => {
  const fullName = stream ? `${className} ${stream}` : className;
  return assigned.some((candidate) => candidate === fullName || candidate === className || candidate.startsWith(`${className} `) || fullName.startsWith(`${candidate} `));
};
const textValue = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value : fallback;
const operationDocumentRow = (item: OperationRecord, pupilName?: string) => {
  const title = textValue(item.title, pupilName ? `Pupil admission form · ${pupilName}` : "School document");
  return {
    id: item.id,
    name: textValue(item.name, title),
    type: textValue(item.type, textValue(item.documentType, "school_document")),
    updatedAt: textValue(item.updatedAt, textValue(item.generatedAt, textValue(item.registeredAt, "Not recorded"))),
    visibility: textValue(item.visibility, "School administration"),
  };
};

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
  if (!user || user.status !== "active" || !verifyPassword(parsed.data.password, user.password)) {
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

router.get("/users", async (req, res): Promise<void> => {
  const actor = await requireUser(req);
  if (!actor) { errorResponse(res, 401, "Not signed in"); return; }
  if (!canViewUsers(actor)) { errorResponse(res, 403, "Administrator access required."); return; }
  res.json(ListUsersResponse.parse(await listUsers()));
});

router.post("/users", async (req, res): Promise<void> => {
  const actor = await requireUser(req);
  if (!canManageUsers(actor)) { errorResponse(res, 403, "Administrator access required."); return; }
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Complete the account name, identifier, role, and password."); return; }
  try {
    const created = await createUser(parsed.data);
    req.log.info({ actorId: actor?.id, accountId: created.id, role: created.role }, "School account created");
    if (actor) await recordAccountAudit(actor, "created", created.id, { role: created.role, identifier: created.identifier });
    res.status(201).json(CreateUserResponse.parse(publicUser(created)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The account could not be created.";
    errorResponse(res, message.includes("already in use") ? 409 : 400, message);
  }
});

router.patch("/users/:userId", async (req, res): Promise<void> => {
  const actor = await requireUser(req);
  if (!canManageUsers(actor)) { errorResponse(res, 403, "Administrator access required."); return; }
  if (actor?.id === req.params.userId && req.body?.status === "inactive") { errorResponse(res, 400, "You cannot deactivate your own account."); return; }
  const parsed = UpdateUserProfileByAdminBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Enter valid account details."); return; }
  if (parsed.data.role && actor?.role !== "super_admin" && parsed.data.role !== (await findUserById(req.params.userId))?.role) {
    errorResponse(res, 403, "Only the Super Admin can change account roles."); return;
  }
  try {
    const updated = await updateUserAdmin(req.params.userId, parsed.data);
    if (!updated) { errorResponse(res, 404, "Account not found."); return; }
    req.log.info({ actorId: actor?.id, accountId: updated.id }, "School account updated");
    if (actor) await recordAccountAudit(actor, "updated", updated.id, { status: updated.status, role: updated.role });
    res.json(UpdateUserProfileByAdminResponse.parse(publicUser(updated)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The account could not be updated.";
    errorResponse(res, message.includes("already") ? 409 : 400, message);
  }
});

router.delete("/users/:userId", async (req, res): Promise<void> => {
  const actor = await requireUser(req);
  if (actor?.role !== "super_admin") { errorResponse(res, 403, "Only the Super Admin can delete accounts."); return; }
  if (actor.id === req.params.userId) { errorResponse(res, 400, "You cannot delete your own account."); return; }
  const deleted = await deleteUser(req.params.userId);
  if (!deleted) { errorResponse(res, 404, "Account not found."); return; }
  req.log.info({ actorId: actor.id, accountId: req.params.userId }, "School account deleted");
  await recordAccountAudit(actor, "deleted", req.params.userId);
  res.json(DeleteUserResponse.parse({ message: "Account deleted successfully." }));
});

router.patch("/users/:userId/permissions", async (req, res): Promise<void> => {
  const actor = await requireUser(req);
  if (!canManageUsers(actor)) { errorResponse(res, 403, "Administrator access required."); return; }
  const parsed = UpdateUserPermissionsBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Choose valid permissions and class assignments."); return; }
  try {
    const existing = await findUserById(req.params.userId);
    if (!existing) { errorResponse(res, 404, "Account not found."); return; }
    const updated = await updateUserAdmin(req.params.userId, { permissions: parsed.data.permissions });
    if (!updated) { errorResponse(res, 404, "Account not found."); return; }
    const requestedClasses = (parsed.data.assignedClasses || []).map((value) => {
      const [name, stream] = value.split("::");
      return classAssignmentKey(name, stream);
    });
    const classRows = await listOperation("classes");
    await Promise.all(classRows.filter((item) => item.teacherId === existing.id && !requestedClasses.includes(classAssignmentKey(String(item.name), String(item.stream ?? "")))).map((item) => updateOperation("classes", item.id, { ...item, teacherId: null, teacherName: "Unassigned" })));
    await Promise.all(classRows.filter((item) => existing.role === "teacher" && requestedClasses.includes(classAssignmentKey(String(item.name), String(item.stream ?? "")))).map((item) => updateOperation("classes", item.id, { ...item, teacherId: existing.id, teacherName: existing.name })));
    const refreshed = await findUserById(req.params.userId);
    if (actor) await recordAccountAudit(actor, "permissions updated", req.params.userId, { permissions: parsed.data.permissions, assignedClasses: requestedClasses });
    res.json(UpdateUserPermissionsResponse.parse(publicUser(refreshed || updated)));
  } catch (error) {
    errorResponse(res, 400, error instanceof Error ? error.message : "Permissions could not be updated.");
  }
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const [allStudents, allAttendance, allPayments, settings, classesRows, subjectsRows, usersRows, teacherClasses] = await Promise.all([
    listStudents(), listAttendance(), listPayments(), getSchoolSettings(), listOperation("classes"), listOperation("subjects"), listUsers(), assignedClassNames(user),
  ]);
  const visibleClasses = user.role === "teacher" ? classesRows.filter((item) => matchesAssignedClass(teacherClasses, String(item.name), String(item.stream ?? ""))) : classesRows;
  const visibleStudents = user.studentId ? allStudents.filter((item) => item.id === user.studentId) : user.role === "teacher" ? allStudents.filter((item) => matchesAssignedClass(teacherClasses, item.className, item.stream)) : allStudents;
  const visibleAttendance = user.studentId ? allAttendance.filter((item) => item.studentId === user.studentId) : user.role === "teacher" ? allAttendance.filter((item) => matchesAssignedClass(teacherClasses, item.className)) : allAttendance;
  const present = visibleAttendance.filter((item) => item.status === "present").length;
  const trendDates = [...new Set(visibleAttendance.map((item) => item.date))].sort().slice(-7);
  const attendanceTrend = trendDates.map((date) => {
    const dayRecords = visibleAttendance.filter((item) => item.date === date);
    const total = dayRecords.length || 1;
    return {
      day: new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" }),
      present: Math.round((dayRecords.filter((item) => item.status === "present").length / total) * 100),
      absent: Math.round((dayRecords.filter((item) => item.status === "absent").length / total) * 100),
    };
  });
  const teacherCount = usersRows.filter((item) => item.role === "teacher").length;
  const staffCount = usersRows.filter((item) => item.userType === "staff" && !administratorRoles.includes(item.role)).length;
  const payload = {
    role: user.role, greeting: roleGreeting(user.name),
    summary: { students: visibleStudents.length, teachers: teacherCount, staff: staffCount, classes: visibleClasses.length, attendance: visibleAttendance.length ? Math.round((present / visibleAttendance.length) * 100) : 0, absent: visibleAttendance.filter((item) => item.status === "absent").length, feesCollected: isAdministrator(user) || user.role === "accountant" ? allPayments.reduce((sum, item) => sum + item.amount, 0) : 0, outstandingFees: visibleStudents.reduce((sum, item) => sum + item.feeBalance, 0) },
    attendanceTrend, performance: [], recentAdmissions: visibleStudents.slice(0, 4), upcomingEvents: [], quickActions: ["Register pupil", "Take attendance", "Send announcement", "View reports"],
    assignedClasses: user.role === "teacher" ? teacherClasses : undefined, assignedSubjects: user.role === "teacher" ? subjectsRows.filter((item) => item.teacherId === user.id || matchesAssignedClass(teacherClasses, String(item.className), String(item.stream ?? ""))).map((item) => String(item.name)) : undefined,
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
  const visible = user.studentId ? rows.filter((item) => item.id === user.studentId) : user.role === "teacher" ? rows.filter((item) => matchesAssignedClass(classesForTeacher, item.className, item.stream)) : isAdministrator(user) || user.role === "accountant" ? rows : [];
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
    const result = { ...created.student, ...(created.payment ? { receiptNumber: created.payment.receiptNumber } : {}), admissionForm: created.admissionForm };
    res.status(201).json(CreateStudentResponse.parse(result));
  } catch { errorResponse(res, 409, "A pupil could not be registered. Please try again."); }
});
router.get("/students/:studentId/admission-form", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const student = await getStudent(req.params.studentId);
  if (!student) { errorResponse(res, 404, "Admission form not found."); return; }
  if (!isAdministrator(user) && user.studentId !== student.id) { errorResponse(res, 403, "You do not have access to this admission form."); return; }
  const form = await getAdmissionForm(req.params.studentId);
  if (!form) { errorResponse(res, 404, "Admission form not found."); return; }
  res.json(GetAdmissionFormResponse.parse(form));
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
  if (user.role === "teacher" && !matchesAssignedClass(assigned, student.className, student.stream)) { errorResponse(res, 403, "You do not have access to this assigned class."); return; }
  res.json(GetStudentResponse.parse({ ...student, academicHistory: [] }));
});
router.patch("/students/:studentId", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!isAdministrator(user)) { errorResponse(res, 403, "Only administrators can update pupil records."); return; }
  const body = { ...(req.body as Record<string, unknown>) };
  for (const key of ["firstName", "lastName", "dateOfBirth", "gender", "className", "guardianName", "guardianPhone"]) {
    if (typeof body[key] === "string" && !body[key].trim()) delete body[key];
  }
  const parsed = UpdateStudentBody.safeParse(body);
  if (!parsed.success) { errorResponse(res, 400, "Enter valid pupil details. Passwords must be at least 8 characters."); return; }
  try {
    const updated = await updateStudent(req.params.studentId, parsed.data);
    if (!updated) { errorResponse(res, 404, "Student not found."); return; }
    res.json(UpdateStudentResponse.parse({ ...updated, academicHistory: [] }));
  } catch {
    errorResponse(res, 409, "The pupil record could not be updated.");
  }
});

router.get("/attendance", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const parsed = GetAttendanceQueryParams.safeParse(req.query);
  if (!parsed.success) { errorResponse(res, 400, "Invalid attendance filters."); return; }
  const assigned = await assignedClassNames(user);
  const records = await listAttendance();
  const visible = records.filter((record) => (!parsed.data.date || record.date === parsed.data.date) && (!parsed.data.className || record.className === parsed.data.className || record.className.startsWith(`${parsed.data.className} `)) && (user.studentId ? record.studentId === user.studentId : user.role === "teacher" ? matchesAssignedClass(assigned, record.className) : isAdministrator(user)));
  res.json(GetAttendanceResponse.parse(visible));
});
router.post("/attendance", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "teacher")) { errorResponse(res, 403, "Only administrators and assigned teachers can mark attendance."); return; }
  const parsed = SaveAttendanceBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Choose a pupil, date, and attendance status."); return; }
  const student = await getStudent(parsed.data.studentId);
  if (!student) { errorResponse(res, 404, "Student not found"); return; }
  if (user.role === "teacher" && !matchesAssignedClass(await assignedClassNames(user), student.className, student.stream)) { errorResponse(res, 403, "Teachers can only mark their assigned classes."); return; }
  if (parsed.data.status === "late" && !parsed.data.arrivalTime) { errorResponse(res, 400, "Record the arrival time for a late pupil."); return; }
  const record = await saveAttendance(student.id, parsed.data.date, parsed.data.status as AttendanceStatus, parsed.data.arrivalTime);
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
router.get("/attendance/deleted", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const deleted = await listDeletedAttendanceRegisters();
  const assigned = user.role === "teacher" ? await assignedClassNames(user) : [];
  const visible = user.role === "teacher"
    ? deleted.filter((item) => matchesAssignedClass(assigned, item.className))
    : isAdministrator(user) ? deleted : [];
  res.json(GetDeletedAttendanceRegistersResponse.parse(visible));
});
router.delete("/attendance/register", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "teacher")) { errorResponse(res, 403, "Only administrators and assigned teachers can delete attendance registers."); return; }
  const parsed = DeleteAttendanceRegisterBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Enter a reason of at least three characters before deleting the register."); return; }
  if (user.role === "teacher" && !(await assignedClassNames(user)).some((assignedClass) => assignedClass === parsed.data.className || assignedClass.startsWith(`${parsed.data.className} `))) {
    errorResponse(res, 403, "Teachers can only delete registers for assigned classes."); return;
  }
  const deleted = await deleteAttendanceRegister(parsed.data.date, parsed.data.className, parsed.data.reason, user.id);
  if (!deleted) { errorResponse(res, 404, "Attendance register not found or already deleted."); return; }
  res.json(DeleteAttendanceRegisterResponse.parse(deleted));
});

router.get("/finance/summary", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant" && !hasPermission(user, "finance_view"))) { errorResponse(res, 403, "Finance access is limited to users with finance permission."); return; }
  const [rows, studentsRows] = await Promise.all([listPayments(), listStudents()]);
  const collected = rows.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.amount, 0);
  const outstanding = studentsRows.reduce((sum, item) => sum + item.feeBalance, 0);
  res.json(GetFinanceSummaryResponse.parse({ collected, outstanding, collectionRate: collected + outstanding ? Math.round((collected / (collected + outstanding)) * 100) : 0, trend: 0, monthly: [] }));
});
router.get("/finance/payments", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant" && !hasPermission(user, "finance_view"))) { errorResponse(res, 403, "Finance access is limited to users with finance permission."); return; }
  res.json(ListPaymentsResponse.parse(await listPayments()));
});
router.post("/finance/payments", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant" && !hasPermission(user, "finance_view"))) { errorResponse(res, 403, "Only users with finance permission can record payments."); return; }
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
router.patch("/finance/payments/:paymentId", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant" && !hasPermission(user, "finance_view"))) { errorResponse(res, 403, "Only users with finance permission can edit payments."); return; }
  const parsed = UpdatePaymentBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Enter a valid non-negative amount, payment method, and reference."); return; }
  try {
    const payment = await updatePayment(req.params.paymentId, parsed.data.amount, parsed.data.method, parsed.data.reference);
    if (!payment) { errorResponse(res, 404, "Payment not found"); return; }
    res.json(UpdatePaymentResponse.parse(payment));
  } catch {
    errorResponse(res, 409, "The payment could not be updated.");
  }
});

router.get("/finance/expenses", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant" && !hasPermission(user, "expenses_view"))) { errorResponse(res, 403, "Only users with expense permission can view expenses."); return; }
  res.json(ListExpensesResponse.parse(await listOperation("expenses")));
});
router.post("/finance/expenses", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant" && !hasPermission(user, "expenses_view"))) { errorResponse(res, 403, "Only users with expense permission can add expenses."); return; }
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Enter a category, description, amount, date, and reference."); return; }
  const item = await createOperation("expenses", { ...parsed.data, status: isAdministrator(user) ? "Approved" : "Pending approval" });
  res.status(201).json(CreateExpenseResponse.parse(item));
});
router.patch("/finance/expenses/:expenseId/approve", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!hasPermission(user, "expense_approve")) { errorResponse(res, 403, "You do not have permission to approve expenses."); return; }
  const rows = await listOperation("expenses");
  const expense = rows.find((item) => item.id === req.params.expenseId);
  if (!expense) { errorResponse(res, 404, "Expense not found."); return; }
  const updated = await updateOperation("expenses", expense.id, { ...expense, status: "Approved", approvedBy: user?.name, approvedAt: getDateLabel() });
  res.json(CreateExpenseResponse.parse(updated));
});
router.delete("/finance/expenses/:expenseId", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!hasPermission(user, "expense_delete")) { errorResponse(res, 403, "You do not have permission to delete expenses."); return; }
  const deleted = await deleteOperation("expenses", req.params.expenseId);
  if (!deleted) { errorResponse(res, 404, "Expense not found."); return; }
  res.status(204).send();
});
router.get("/finance/salaries", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant" && !hasPermission(user, "finance_view"))) { errorResponse(res, 403, "Only users with finance permission can view salary payments."); return; }
  res.json(ListSalariesResponse.parse(await listSalaryPayments()));
});
router.get("/finance/salary-staff", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant" && !hasPermission(user, "finance_view"))) { errorResponse(res, 403, "Only users with finance permission can view salary accounts."); return; }
  res.json((await listSalaryStaff()));
});
router.post("/finance/salaries", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user || (!isAdministrator(user) && user.role !== "accountant")) { errorResponse(res, 403, "Only finance roles can pay salaries."); return; }
  const parsed = CreateSalaryPaymentBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Choose a staff member, pay period, amount, method, and reference."); return; }
  try {
    const item = await recordSalaryPayment(parsed.data);
    if (!item) { errorResponse(res, 404, "Staff account not found."); return; }
    res.status(201).json(CreateSalaryPaymentResponse.parse(item));
  } catch (error) {
    errorResponse(res, 409, error instanceof Error ? error.message : "Salary payment could not be recorded.");
  }
});

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
  const visible = user.role === "teacher" ? rows.filter((item) => matchesAssignedClass(assigned, String(item.className))) : student ? rows.filter((item) => item.className === `${student.className} ${student.stream}`) : isAdministrator(user) || user.role === "staff" || user.role === "accountant" ? rows : [];
  res.json(GetTimetableResponse.parse(visible));
});
router.post("/academics/timetable", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!isAdministrator(user)) { errorResponse(res, 403, "Only administrators can create timetable entries."); return; }
  const parsed = CreateTimetableEntryBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Complete the day, time, subject, teacher, class, and room."); return; }
  const classesRows = await listOperation("classes");
  const classRow = classesRows.find((item) => classAssignmentKey(String(item.name), String(item.stream ?? "")) === parsed.data.className.trim());
  if (!classRow) { errorResponse(res, 400, "Choose an existing class and stream."); return; }
  const subjectRows = await listOperation("subjects");
  if (!subjectRows.some((item) => String(item.name).trim().toLowerCase() === parsed.data.subject.trim().toLowerCase() && classAssignmentKey(String(item.className), String(item.stream ?? "")) === parsed.data.className.trim())) {
    errorResponse(res, 400, "Choose a subject assigned to this class."); return;
  }
  const teacher = (await listUsers()).find((item) => item.role === "teacher" && item.name.trim().toLowerCase() === parsed.data.teacher.trim().toLowerCase());
  if (!teacher) { errorResponse(res, 400, "Choose a registered teacher."); return; }
  const item = await createOperation("timetable", { ...parsed.data, className: classAssignmentKey(String(classRow.name), String(classRow.stream ?? "")), teacher: teacher.name, accent: parsed.data.accent || "hsl(var(--primary))" });
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
  if (user.role === "teacher" && !matchesAssignedClass(await assignedClassNames(user), student.className, student.stream)) { errorResponse(res, 403, "You do not have access to this assigned class."); return; }
  const settings = await getSchoolSettings();
  const saved = (await listOperation("reports")).find((item) => item.studentId === student.id && item.term === "Term 3" && item.academicYear === settings.academicYear);
  res.json(GetReportCardResponse.parse(reportCardFor(student, saved, await listOperation("reports"))));
});
router.post("/academics/report-cards/:studentId", async (req, res): Promise<void> => {
  const parsedParams = GetReportCardParams.safeParse(req.params);
  const user = await requireUser(req);
  if (!parsedParams.success) { errorResponse(res, 400, "Invalid student id."); return; }
  const student = await getStudent(parsedParams.data.studentId);
  if (!student) { errorResponse(res, 404, "Student not found"); return; }
  if (!user || (!isAdministrator(user) && user.role !== "teacher")) { errorResponse(res, 403, "Only administrators and assigned teachers can record marks."); return; }
  if (user.role === "teacher" && !matchesAssignedClass(await assignedClassNames(user), student.className, student.stream)) { errorResponse(res, 403, "Teachers can only record marks for assigned classes."); return; }
  const parsed = CreateReportCardBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Enter all marks between 0 and 100 for every subject."); return; }
  const reports = await listOperation("reports");
  const settings = await getSchoolSettings();
  const previous = reports.find((item) => item.studentId === student.id && item.term === parsed.data.term && item.academicYear === parsed.data.academicYear);
  const data = { ...parsed.data, studentId: student.id, className: student.className, stream: student.stream, teacherId: user.id, overallAverage: parsed.data.subjects.length ? parsed.data.subjects.reduce((sum, item) => sum + (item.beginning + item.midterm + item.tests + item.endOfTerm) / 4, 0) / parsed.data.subjects.length : 0 };
  const saved = previous ? await updateOperation("reports", previous.id, data) : await createOperation("reports", data);
  if (!saved) { errorResponse(res, 500, "The report card could not be saved."); return; }
  res.status(201).json(CreateReportCardResponse.parse(reportCardFor(student, saved, reports.filter((item) => item.id !== previous?.id).concat(saved))));
});

router.get("/operations/subjects", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const rows = await listOperation("subjects");
  const assigned = await assignedClassNames(user);
  const visible = isAdministrator(user) || user.permissions.includes("subjects_view") || user.permissions.includes("subjects_manage")
    ? rows
    : user.role === "teacher"
      ? rows.filter((item) => matchesAssignedClass(assigned, String(item.className), String(item.stream ?? "")) || item.teacherId === user.id || item.createdBy === user.id)
      : [];
  res.json(ListSubjectsResponse.parse(visible));
});

router.post("/operations/subjects", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  if (!canManageSubjects(user)) { errorResponse(res, 403, "You do not have permission to manage subjects."); return; }
  const parsed = CreateSubjectBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Enter a subject name and choose the class."); return; }
  const data = parsed.data;
  const classesRows = await listOperation("classes");
  const classRow = data.classId
    ? classesRows.find((item) => item.id === data.classId)
    : classesRows.find((item) => classAssignmentKey(String(item.name), String(item.stream ?? "")) === classAssignmentKey(data.className, data.stream));
  if (!classRow) { errorResponse(res, 400, "Choose an existing class and stream."); return; }
  const teacher = data.teacherId ? await findUserById(data.teacherId) : data.teacherName ? (await listUsers()).find((item) => item.role === "teacher" && item.name.toLowerCase() === data.teacherName?.toLowerCase()) : user.role === "teacher" ? user : undefined;
  if (data.teacherId && (!teacher || teacher.role !== "teacher")) { errorResponse(res, 400, "Choose a registered teacher."); return; }
  if (user.role === "teacher" && (classRow.teacherId !== user.id || (teacher && teacher.id !== user.id))) { errorResponse(res, 403, "Teachers can only add subjects to their assigned classes."); return; }
  const existing = await listOperation("subjects");
  if (existing.some((item) => String(item.name).toLowerCase() === data.name.trim().toLowerCase() && (String(item.classId || "") === classRow.id || classAssignmentKey(String(item.className), String(item.stream ?? "")) === classAssignmentKey(String(classRow.name), String(classRow.stream ?? ""))))) {
    errorResponse(res, 409, "That subject is already registered for this class."); return;
  }
  const created = await createOperation("subjects", {
    name: data.name.trim(), classId: classRow.id, className: String(classRow.name), stream: String(classRow.stream ?? ""),
    teacherId: teacher?.id || null, teacherName: teacher?.name || "Unassigned", createdBy: user.id, status: "Active",
  });
  if (!created) { errorResponse(res, 500, "The subject could not be created."); return; }
  res.status(201).json(CreateSubjectResponse.parse(created));
});

router.patch("/operations/subjects/:subjectId", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  if (!canManageSubjects(user)) { errorResponse(res, 403, "You do not have permission to manage subjects."); return; }
  const params = UpdateSubjectParams.safeParse(req.params);
  const parsed = UpdateSubjectBody.safeParse(req.body);
  if (!params.success || !parsed.success) { errorResponse(res, 400, "Enter valid subject details."); return; }
  const existing = (await listOperation("subjects")).find((item) => item.id === params.data.subjectId);
  if (!existing) { errorResponse(res, 404, "Subject not found."); return; }
  if (!isAdministrator(user) && existing.teacherId !== user.id && existing.createdBy !== user.id) { errorResponse(res, 403, "You can only edit subjects assigned to you."); return; }
  const classesRows = await listOperation("classes");
  const data = parsed.data;
  const classRow = data.classId ? classesRows.find((item) => item.id === data.classId) : classesRows.find((item) => classAssignmentKey(String(item.name), String(item.stream ?? "")) === classAssignmentKey(data.className, data.stream));
  if (!classRow) { errorResponse(res, 400, "Choose an existing class and stream."); return; }
  const teacher = data.teacherId ? await findUserById(data.teacherId) : data.teacherName ? (await listUsers()).find((item) => item.role === "teacher" && item.name.toLowerCase() === data.teacherName?.toLowerCase()) : existing.teacherId ? await findUserById(String(existing.teacherId)) : undefined;
  if (data.teacherId && (!teacher || teacher.role !== "teacher")) { errorResponse(res, 400, "Choose a registered teacher."); return; }
  const duplicate = (await listOperation("subjects")).some((item) => item.id !== existing.id && String(item.name).toLowerCase() === data.name.trim().toLowerCase() && (String(item.classId || "") === classRow.id || classAssignmentKey(String(item.className), String(item.stream ?? "")) === classAssignmentKey(String(classRow.name), String(classRow.stream ?? ""))));
  if (duplicate) { errorResponse(res, 409, "That subject is already registered for this class."); return; }
  const updated = await updateOperation("subjects", existing.id, { ...existing, name: data.name.trim(), classId: classRow.id, className: String(classRow.name), stream: String(classRow.stream ?? ""), teacherId: teacher?.id || null, teacherName: teacher?.name || "Unassigned", updatedAt: new Date().toISOString() });
  if (!updated) { errorResponse(res, 404, "Subject not found."); return; }
  res.json(UpdateSubjectResponse.parse(updated));
});

router.delete("/operations/subjects/:subjectId", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  if (!canDeleteSubjects(user)) { errorResponse(res, 403, "You do not have permission to delete subjects."); return; }
  const params = DeleteSubjectParams.safeParse(req.params);
  if (!params.success) { errorResponse(res, 400, "Invalid subject id."); return; }
  const existing = (await listOperation("subjects")).find((item) => item.id === params.data.subjectId);
  if (!existing) { errorResponse(res, 404, "Subject not found."); return; }
  if (!isAdministrator(user) && existing.teacherId !== user.id && existing.createdBy !== user.id) { errorResponse(res, 403, "You can only delete subjects assigned to you."); return; }
  if (!await deleteOperation("subjects", existing.id)) { errorResponse(res, 404, "Subject not found."); return; }
  res.json(DeleteSubjectResponse.parse({ message: "Subject removed successfully." }));
});
router.post("/operations", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!isAdministrator(user)) { errorResponse(res, 403, "Only administrators can create classes."); return; }
  const parsed = CreateClassBody.safeParse(req.body);
  if (!parsed.success) { errorResponse(res, 400, "Complete the class name, grade, stream, and room."); return; }
  try {
    const created = await createClass(parsed.data);
    res.status(201).json(CreateClassResponse.parse(created));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The class could not be created.";
    errorResponse(res, message.includes("already exists") ? 409 : 400, message);
  }
});
router.get("/operations", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  if (!user) { errorResponse(res, 401, "Not signed in"); return; }
  const settings = await getSchoolSettings();
  const kinds: OperationKind[] = ["classes", "subjects", "assignments", "staff", "parents", "expenses", "salaryPayments", "discipline", "medical", "library", "transport", "inventory", "events", "documents", "reports", "notifications"];
  const loaded = await Promise.all(kinds.map(async (kind) => [kind, kind === "salaryPayments" ? await listSalaryPayments() : await listOperation(kind)] as const));
  const data = Object.fromEntries(loaded) as Record<OperationKind, OperationRecord[]>;
  const students = await listStudents();
  const assigned = await assignedClassNames(user);
  const linked = user.studentId
    ? students.filter((item) => item.id === user.studentId)
    : user.role === "teacher"
      ? students.filter((item) => matchesAssignedClass(assigned, item.className, item.stream))
      : isAdministrator(user)
        ? students
        : [];
  const visibleClasses = user.role === "teacher" ? data.classes.filter((item) => matchesAssignedClass(assigned, String(item.name), String(item.stream ?? ""))) : data.classes;
  const studentIds = new Set(linked.map((item) => item.id));
  const linkedClasses = new Set(linked.map((item) => `${item.className} ${item.stream}`));
  const documentRows = data.documents.map((item) => {
    const pupil = students.find((student) => student.id === item.studentId);
    return operationDocumentRow(item, pupil?.name);
  });
  const modules = {
    classes: visibleClasses, subjects: isAdministrator(user) ? data.subjects : data.subjects.filter((item) => matchesAssignedClass(assigned, String(item.className))), assignments: isAdministrator(user) ? data.assignments : data.assignments.filter((item) => matchesAssignedClass(assigned, String(item.className))),
    staff: isAdministrator(user) ? data.staff : [], parents: isAdministrator(user) ? data.parents : [],
    expenses: isAdministrator(user) || user.role === "accountant" || hasPermission(user, "expenses_view") ? data.expenses : [], salaries: isAdministrator(user) || user.role === "accountant" ? data.salaryPayments : [],
     discipline: data.discipline.filter((item) => studentIds.has(String(item.studentId))), medical: isAdministrator(user) || user.role === "nurse" ? data.medical : data.medical.filter((item) => studentIds.has(String(item.studentId))),
     library: data.library, transport: data.transport, inventory: isAdministrator(user) || user.role === "staff" || user.role === "librarian" ? data.inventory : [], events: data.events,
     documents: isAdministrator(user) || user.role === "staff" || user.role === "secretary" ? documentRows : [], reports: isAdministrator(user) || user.role === "accountant" ? data.reports : [], notifications: data.notifications,
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