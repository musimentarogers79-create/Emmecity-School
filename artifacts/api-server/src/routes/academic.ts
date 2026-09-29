import { Router, type IRouter } from "express";
import {
  CreateAcademicYearBody, CreateAcademicYearResponse, ListAcademicYearsResponse, ImportCurrentEnrollmentsParams,
  ImportCurrentEnrollmentsResponse, ListAcademicEnrollmentsParams, ListAcademicEnrollmentsResponse,
  CreateAcademicEnrollmentResponse, CreateAcademicEnrollmentBody,
  OpenAcademicTermParams, OpenAcademicTermResponse, CloseAcademicTermParams, CloseAcademicTermResponse,
  OpenAcademicTermBody, ListAcademicTermFeeSchedulesParams, ListAcademicTermFeeSchedulesResponse,
  UpsertAcademicTermFeeScheduleParams, UpsertAcademicTermFeeScheduleBody, UpsertAcademicTermFeeScheduleResponse,
  GetTermFeeStatementParams, GetTermFeeStatementResponse, CreateAcademicFeeChargeParams,
  CreateAcademicFeeChargeBody, CreateAcademicFeeChargeResponse, RecordAcademicPaymentParams,
  RecordAcademicPaymentBody, RecordAcademicPaymentResponse, CreateAcademicAdjustmentParams,
  CreateAcademicAdjustmentBody, CreateAcademicAdjustmentResponse, RecordAcademicDepartureParams,
  RecordAcademicDepartureBody, RecordAcademicDepartureResponse, CreatePromotionCycleBody,
  CreatePromotionCycleResponse, ListPromotionDecisionsParams, ListPromotionDecisionsResponse,
  UpdatePromotionDecisionParams, UpdatePromotionDecisionBody, UpdatePromotionDecisionResponse,
  ConfirmPromotionCycleParams, ConfirmPromotionCycleResponse, GetAcademicDashboardQueryParams,
  GetAcademicDashboardResponse, GetStudentAcademicHistoryParams, GetStudentAcademicHistoryResponse,
  AllocateExistingAcademicPaymentParams, AllocateExistingAcademicPaymentBody, AllocateExistingAcademicPaymentResponse,
} from "@workspace/api-zod";
import { currentUserFromToken } from "../lib/school-data";
import {
  closeAcademicTerm, confirmPromotionCycle, createAcademicAdjustment, createAcademicYear,
  createEnrollment, createFeeCharge, createPromotionCycle, getAcademicDashboard,
  getStudentAcademicHistory, getTermFeeStatement, importCurrentEnrollments,
  allocateExistingPayment, listAcademicEnrollments, listAcademicYears, listPromotionDecisions,
  listTermFeeSchedules, openAcademicTerm, recordAcademicPayment, updatePromotionDecision,
  upsertTermFeeSchedule, withdrawEnrollment,
} from "../lib/academic-finance";

const router: IRouter = Router();
type Request = Parameters<Parameters<IRouter["get"]>[1]>[0];
type Response = Parameters<Parameters<IRouter["get"]>[1]>[1];
const userFromRequest = (req: Request) => {
  const token = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("schoolops_session="))?.slice("schoolops_session=".length);
  return currentUserFromToken(token);
};
const isAdministrator = (role: string) => role === "super_admin" || role === "administrator";
const isFinanceUser = (role: string) => isAdministrator(role) || role === "accountant";
const fail = (res: Response, status: number, message: string) => { res.status(status).json({ error: message }); };
const errorText = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

router.get("/academic/years", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user) { fail(res, 401, "Not signed in"); return; }
  res.json(ListAcademicYearsResponse.parse(await listAcademicYears()));
});

router.post("/academic/years", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Administrator access is required."); return; }
  const parsed = CreateAcademicYearBody.safeParse(req.body);
  if (!parsed.success || !Number.isInteger(parsed.data?.year)) { fail(res, 400, "Enter a valid academic year."); return; }
  try {
    const year = await createAcademicYear(parsed.data.year, user.id);
    res.status(201).json(CreateAcademicYearResponse.parse({ ...year, terms: (await listAcademicYears()).find((item) => item.id === year.id)?.terms ?? [] }));
  } catch (error) { fail(res, 409, errorText(error, "Unable to create academic year.")); }
});

router.post("/academic/years/:yearId/import-current", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Administrator access is required."); return; }
  const params = ImportCurrentEnrollmentsParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, "Invalid academic year id."); return; }
  try {
    const result = await importCurrentEnrollments(params.data.yearId);
    if (!result) { fail(res, 404, "Academic year not found."); return; }
    res.json(ImportCurrentEnrollmentsResponse.parse(result));
  } catch (error) { fail(res, 409, errorText(error, "Unable to add pupils to this year.")); }
});

router.get("/academic/years/:yearId/enrollments", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user) { fail(res, 401, "Not signed in"); return; }
  if (!isAdministrator(user.role) && !["secretary", "accountant"].includes(user.role)) { fail(res, 403, "Academic enrollment access is restricted."); return; }
  const params = ListAcademicEnrollmentsParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, "Invalid academic year id."); return; }
  res.json(ListAcademicEnrollmentsResponse.parse(await listAcademicEnrollments(params.data.yearId)));
});

router.post("/academic/enrollments", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Administrator access is required."); return; }
  const parsed = CreateAcademicEnrollmentBody.safeParse(req.body);
  if (!parsed.success) { fail(res, 400, "Choose an existing pupil, year, class, and valid enrollment date."); return; }
  try {
    const enrollment = await createEnrollment({
      ...parsed.data,
      enrolledOn: parsed.data.enrolledOn instanceof Date ? parsed.data.enrolledOn.toISOString().slice(0, 10) : parsed.data.enrolledOn,
    });
    if (!enrollment) { fail(res, 404, "Academic year or existing pupil profile not found."); return; }
    res.status(201).json(CreateAcademicEnrollmentResponse.parse(enrollment));
  } catch (error) { fail(res, 409, errorText(error, "Unable to create enrollment.")); }
});

router.post("/academic/terms/:termId/open", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Administrator access is required."); return; }
  const params = OpenAcademicTermParams.safeParse(req.params);
  const parsed = OpenAcademicTermBody.safeParse(req.body);
  if (!params.success || !parsed.success) { fail(res, 400, "Provide a valid term id and start/end dates."); return; }
  let term;
  try {
    term = await openAcademicTerm(params.data.termId, {
      startsOn: parsed.data.startsOn.toISOString().slice(0, 10),
      endsOn: parsed.data.endsOn.toISOString().slice(0, 10),
    }, user.id);
  } catch (error) { fail(res, 409, errorText(error, "Unable to open academic term.")); return; }
  if (!term) { fail(res, 404, "Academic term not found."); return; }
  res.json(OpenAcademicTermResponse.parse(term));
});

router.post("/academic/terms/:termId/close", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Administrator access is required."); return; }
  const params = CloseAcademicTermParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, "Invalid term id."); return; }
  const term = await closeAcademicTerm(params.data.termId);
  if (!term) { fail(res, 404, "Academic term not found."); return; }
  res.json(CloseAcademicTermResponse.parse(term));
});

router.get("/academic/terms/:termId/charges", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isFinanceUser(user.role)) { fail(res, 403, "Finance access is required."); return; }
  const params = GetTermFeeStatementParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, "Invalid term id."); return; }
  const statement = await getTermFeeStatement(params.data.termId);
  if (!statement) { fail(res, 404, "Academic term not found."); return; }
  res.json(GetTermFeeStatementResponse.parse(statement));
});

router.get("/academic/terms/:termId/fee-schedules", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isFinanceUser(user.role)) { fail(res, 403, "Finance access is required."); return; }
  const params = ListAcademicTermFeeSchedulesParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, "Invalid term id."); return; }
  const schedules = await listTermFeeSchedules(params.data.termId);
  if (!schedules) { fail(res, 404, "Academic term not found."); return; }
  res.json(ListAcademicTermFeeSchedulesResponse.parse(schedules));
});

router.put("/academic/terms/:termId/fee-schedules", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Administrator access is required to configure fee schedules."); return; }
  const params = UpsertAcademicTermFeeScheduleParams.safeParse(req.params);
  const parsed = UpsertAcademicTermFeeScheduleBody.safeParse(req.body);
  if (!params.success || !parsed.success) { fail(res, 400, "Enter a valid class, category, amount, stream, and enrollment type."); return; }
  try {
    const schedule = await upsertTermFeeSchedule({ ...parsed.data, termId: params.data.termId, actorId: user.id });
    if (!schedule) { fail(res, 404, "Academic term not found."); return; }
    res.status(200).json(UpsertAcademicTermFeeScheduleResponse.parse(schedule));
  } catch (error) { fail(res, 409, errorText(error, "Unable to configure this term fee schedule.")); }
});

router.post("/academic/terms/:termId/charges", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || (!isAdministrator(user.role) && user.role !== "accountant")) { fail(res, 403, "Finance access is required."); return; }
  const params = CreateAcademicFeeChargeParams.safeParse(req.params);
  const parsed = CreateAcademicFeeChargeBody.safeParse(req.body);
  if (!params.success || !parsed.success) { fail(res, 400, "Enter a valid enrollment, fee category, amount, and idempotency key."); return; }
  try {
    const charge = await createFeeCharge({ ...parsed.data, termId: params.data.termId, actorId: user.id });
    res.status(201).json(CreateAcademicFeeChargeResponse.parse(charge));
  } catch (error) { fail(res, 409, errorText(error, "Unable to create term charge.")); }
});

router.post("/academic/charges/:chargeId/payments", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || (!isAdministrator(user.role) && user.role !== "accountant")) { fail(res, 403, "Finance access is required."); return; }
  const params = RecordAcademicPaymentParams.safeParse(req.params);
  const parsed = RecordAcademicPaymentBody.safeParse(req.body);
  if (!params.success || !parsed.success) { fail(res, 400, "Enter a valid amount and payment method."); return; }
  try {
    const payment = await recordAcademicPayment({ ...parsed.data, chargeId: params.data.chargeId, actorId: user.id });
    if (!payment) { fail(res, 404, "Term charge not found."); return; }
    res.status(201).json(RecordAcademicPaymentResponse.parse(payment));
  } catch (error) { fail(res, 409, errorText(error, "Unable to allocate payment to the selected charge.")); }
});

router.post("/academic/payments/:paymentId/allocations", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || (!isAdministrator(user.role) && user.role !== "accountant")) { fail(res, 403, "Finance access is required."); return; }
  const params = AllocateExistingAcademicPaymentParams.safeParse(req.params);
  const parsed = AllocateExistingAcademicPaymentBody.safeParse(req.body);
  if (!params.success || !parsed.success) { fail(res, 400, "Select a receipt and term charge, then enter a valid allocation amount and idempotency key."); return; }
  try {
    const allocation = await allocateExistingPayment({ ...parsed.data, paymentId: params.data.paymentId, actorId: user.id });
    if (!allocation) { fail(res, 404, "Legacy payment not found."); return; }
    res.status(201).json(AllocateExistingAcademicPaymentResponse.parse(allocation));
  } catch (error) { fail(res, 409, errorText(error, "Unable to allocate this legacy payment.")); }
});

router.post("/academic/charges/:chargeId/adjustments", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Only administrators can authorize financial adjustments."); return; }
  const params = CreateAcademicAdjustmentParams.safeParse(req.params);
  const parsed = CreateAcademicAdjustmentBody.safeParse(req.body);
  if (!params.success || !parsed.success) { fail(res, 400, "A valid adjustment amount and reason are required."); return; }
  try {
    const adjustment = await createAcademicAdjustment({ ...parsed.data, chargeId: params.data.chargeId, actorId: user.id });
    if (!adjustment) { fail(res, 404, "Term charge not found."); return; }
    res.status(201).json(CreateAcademicAdjustmentResponse.parse(adjustment));
  } catch (error) { fail(res, 409, errorText(error, "Unable to save the audited adjustment.")); }
});

router.post("/academic/enrollments/:enrollmentId/departure", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Administrator access is required."); return; }
  const params = RecordAcademicDepartureParams.safeParse(req.params);
  const parsed = RecordAcademicDepartureBody.safeParse(req.body);
  if (!params.success || !parsed.success) { fail(res, 400, "Enter a leaving type, date, and reason."); return; }
  try {
    const enrollment = await withdrawEnrollment({
      ...parsed.data, enrollmentId: params.data.enrollmentId, actorId: user.id,
      leavingOn: parsed.data.leavingOn instanceof Date ? parsed.data.leavingOn.toISOString().slice(0, 10) : parsed.data.leavingOn,
    });
    if (!enrollment) { fail(res, 404, "Enrollment not found."); return; }
    res.json(RecordAcademicDepartureResponse.parse(enrollment));
  } catch (error) { fail(res, 409, errorText(error, "Unable to record the pupil departure.")); }
});

router.post("/academic/promotion-cycles", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Administrator access is required."); return; }
  const parsed = CreatePromotionCycleBody.safeParse(req.body);
  if (!parsed.success || !Number.isInteger(parsed.data?.toYear)) { fail(res, 400, "Choose a source year and the immediately following year."); return; }
  try {
    const cycle = await createPromotionCycle(parsed.data.fromYearId, parsed.data.toYear, user.id);
    res.status(201).json(CreatePromotionCycleResponse.parse(cycle));
  } catch (error) { fail(res, 409, errorText(error, "Unable to open promotion review.")); }
});

router.get("/academic/promotion-cycles/:cycleId/decisions", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Administrator access is required."); return; }
  const params = ListPromotionDecisionsParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, "Invalid promotion cycle id."); return; }
  res.json(ListPromotionDecisionsResponse.parse(await listPromotionDecisions(params.data.cycleId)));
});

router.put("/academic/promotion-cycles/:cycleId/decisions/:enrollmentId", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Administrator access is required."); return; }
  const params = UpdatePromotionDecisionParams.safeParse(req.params);
  const parsed = UpdatePromotionDecisionBody.safeParse(req.body);
  if (!params.success || !parsed.success) { fail(res, 400, "Enter a valid promotion decision."); return; }
  try {
    const decision = await updatePromotionDecision({ ...parsed.data, ...params.data, actorId: user.id });
    if (!decision) { fail(res, 404, "Promotion decision not found."); return; }
    res.json(UpdatePromotionDecisionResponse.parse(decision));
  } catch (error) { fail(res, 409, errorText(error, "Unable to update promotion decision.")); }
});

router.post("/academic/promotion-cycles/:cycleId/confirm", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isAdministrator(user.role)) { fail(res, 403, "Administrator access is required."); return; }
  const params = ConfirmPromotionCycleParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, "Invalid promotion cycle id."); return; }
  try {
    const result = await confirmPromotionCycle(params.data.cycleId, user.id);
    if (!result) { fail(res, 404, "Promotion cycle not found."); return; }
    res.json(ConfirmPromotionCycleResponse.parse(result));
  } catch (error) { fail(res, 409, errorText(error, "Promotion confirmation failed.")); }
});

router.get("/academic/dashboard", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user || !isFinanceUser(user.role)) { fail(res, 403, "Finance access is required."); return; }
  const parsed = GetAcademicDashboardQueryParams.safeParse(req.query);
  if (!parsed.success) { fail(res, 400, "Invalid academic year filter."); return; }
  res.json(GetAcademicDashboardResponse.parse(await getAcademicDashboard(parsed.data.academicYearId)));
});

router.get("/academic/students/:studentId/history", async (req, res): Promise<void> => {
  const user = await userFromRequest(req);
  if (!user) { fail(res, 401, "Not signed in"); return; }
  const params = GetStudentAcademicHistoryParams.safeParse(req.params);
  if (!params.success) { fail(res, 400, "Invalid pupil id."); return; }
  const linkedToPupil = ["student", "guardian"].includes(user.role) && user.studentId === params.data.studentId;
  if (!isFinanceUser(user.role) && !linkedToPupil) { fail(res, 403, "Academic history is limited to finance users and the linked pupil or guardian."); return; }
  res.json(GetStudentAcademicHistoryResponse.parse(await getStudentAcademicHistory(params.data.studentId)));
});

export default router;