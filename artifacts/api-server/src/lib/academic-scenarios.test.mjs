import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

// Never inherit a managed, hosted, or otherwise preconfigured database target.
const databaseEnvironmentKeys = [
  "NEON_DATABASE_URL",
  "DATABASE_URL",
  "DRIZZLE_DATABASE_URL",
  "PGHOST",
  "PGHOSTADDR",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
  "PGSERVICE",
  "PGSERVICEFILE",
  "PGPASSFILE",
];
for (const key of databaseEnvironmentKeys) delete process.env[key];

const testDir = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = path.resolve(testDir, "../..");
const projectRoot = path.resolve(artifactDir, "../..");
const migrationsDir = path.join(projectRoot, "lib/db/drizzle");
let scratchDir;
let pgBin;
let pgPort;
let databaseUrl;
let database;
let academic;
let schoolId;
let actorId;
let bundledModule;
let pool;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: options.env ?? safeChildEnvironment(),
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with ${result.status}.\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  return result.stdout ?? "";
}

function safeChildEnvironment(extra = {}) {
  const env = { ...process.env };
  for (const key of databaseEnvironmentKeys) delete env[key];
  Object.assign(env, extra);
  return env;
}

function assertLocalDatabaseTarget() {
  assert.equal(process.env.NEON_DATABASE_URL, undefined, "NEON_DATABASE_URL must remain unset");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must point to the scratch database");
  const target = new URL(process.env.DATABASE_URL);
  assert.ok(
    ["127.0.0.1", "::1", "localhost"].includes(target.hostname),
    `Refusing non-local database URL host: ${target.hostname}`,
  );
  assert.equal(target.pathname, "/academic_scenarios");
}

function discoverPostgresBinaries() {
  const store = "/nix/store";
  const candidates = readdirSync(store)
    .filter((entry) => /^[-a-z0-9]+-postgresql-16\./.test(entry))
    .map((entry) => path.join(store, entry, "bin"))
    .filter((bin) => ["initdb", "pg_ctl", "createdb", "psql"].every((file) => existsSync(path.join(bin, file))))
    .sort();
  assert.ok(candidates.length, "Could not find the existing Nix PostgreSQL 16 binaries under /nix/store");
  return candidates[0];
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function addStudent(firstName, className = "P3") {
  return pool.query(
    `INSERT INTO students
      (school_id, registration_number, first_name, last_name, class_name, stream, gender,
       date_of_birth, guardian_name, guardian_phone, admission_date, enrollment_type)
     VALUES ($1, $2, $3, 'Scenario', $4, 'A', 'female',
       '2015-04-12', 'Synthetic Guardian', '+256700000001', '2022-02-01', 'day')
     RETURNING id, registration_number`,
    [schoolId, `SYN-${randomUUID().slice(0, 8)}`, firstName, className],
  ).then(({ rows }) => rows[0]);
}

async function setupPupil(yearNumber, name, className = "P3") {
  const year = await academic.createAcademicYear(yearNumber, actorId);
  const pupil = await addStudent(name, className);
  const enrollment = await academic.createEnrollment({
    yearId: year.id,
    studentId: pupil.id,
    className,
    stream: "A",
    enrolledOn: `${yearNumber}-02-01`,
  });
  const { rows: terms } = await pool.query(
    "SELECT id, number FROM academic_terms WHERE academic_year_id = $1 ORDER BY number",
    [year.id],
  );
  return { year, pupil, enrollment, terms };
}

async function charge(enrollmentId, termId, amount, tag) {
  return academic.createFeeCharge({
    enrollmentId,
    termId,
    category: "Tuition",
    amount,
    description: `Synthetic ${tag} tuition`,
    idempotencyKey: `scenario-${tag}-${randomUUID()}`,
    actorId,
  });
}

async function pay(studentId, chargeId, amount, tag) {
  return academic.recordAcademicPayment({
    studentId,
    chargeId,
    amount,
    method: "cash",
    reference: `SYN-${tag}`,
    idempotencyKey: `scenario-payment-${tag}-${randomUUID()}`,
    actorId,
  });
}

before(async () => {
  pgBin = discoverPostgresBinaries();
  scratchDir = mkdtempSync(path.join(os.tmpdir(), "academic-scenarios-pg-"));
  const dataDir = path.join(scratchDir, "data");
  const socketDir = path.join(scratchDir, "socket");
  const logFile = path.join(scratchDir, "postgres.log");
  const username = process.env.USER || "runner";
  pgPort = await reserveLoopbackPort();
  mkdirSync(socketDir);

  run(path.join(pgBin, "initdb"), [
    "-D", dataDir,
    "--username", username,
    "--auth-local=trust",
    "--auth-host=trust",
    "--encoding=UTF8",
    "--no-locale",
  ]);
  run(path.join(pgBin, "pg_ctl"), [
    "-D", dataDir,
    "-l", logFile,
    "-o", `-h 127.0.0.1 -p ${pgPort} -c listen_addresses=127.0.0.1 -c unix_socket_directories=${socketDir}`,
    "-w", "start",
  ]);
  run(path.join(pgBin, "createdb"), [
    "-h", "127.0.0.1", "-p", String(pgPort), "-U", username, "academic_scenarios",
  ]);

  databaseUrl = `postgresql://${encodeURIComponent(username)}@127.0.0.1:${pgPort}/academic_scenarios`;
  process.env.DATABASE_URL = databaseUrl;
  assertLocalDatabaseTarget();
  const localEnvironment = safeChildEnvironment({ DATABASE_URL: databaseUrl });

  const migrationFiles = readdirSync(migrationsDir).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  assert.ok(migrationFiles.length, `No SQL migrations found in ${migrationsDir}`);
  for (const migration of migrationFiles) {
    run(path.join(pgBin, "psql"), [
      "-X", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(pgPort),
      "-U", username, "-d", "academic_scenarios", "-f", path.join(migrationsDir, migration),
    ], { env: localEnvironment });
  }

  const root = projectRoot.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  const entryFile = path.join(scratchDir, "academic-entry.ts");
  bundledModule = path.join(scratchDir, "academic-finance.bundle.cjs");
  writeFileSync(entryFile, [
    `export * from "${root}/artifacts/api-server/src/lib/academic-finance.ts";`,
    `export { pool } from "${root}/lib/db/src/index.ts";`,
    "",
  ].join("\n"));
  run(path.join(artifactDir, "node_modules/.bin/esbuild"), [
    entryFile, "--bundle", "--platform=node", "--format=cjs", "--packages=bundle", `--outfile=${bundledModule}`,
  ], { env: localEnvironment });

  academic = await import(pathToFileURL(bundledModule));
  pool = academic.pool;
  const { rows: schools } = await pool.query(
    `INSERT INTO school_settings (school_name, academic_year)
     VALUES ('Synthetic Scenario School', '2026') RETURNING id`,
  );
  schoolId = schools[0].id;
  const { rows: actors } = await pool.query(
    `INSERT INTO school_users
      (school_id, name, identifier, password_hash, user_type, role, initials)
     VALUES ($1, 'Synthetic Test Administrator', 'scenario-admin', 'not-a-real-password-hash', 'staff', 'administrator', 'STA')
     RETURNING id`,
    [schoolId],
  );
  actorId = actors[0].id;
}, { timeout: 120_000 });

after(async () => {
  try {
    await pool?.end();
  } finally {
    if (scratchDir && pgBin) {
      const dataDir = path.join(scratchDir, "data");
      if (existsSync(dataDir)) {
        try {
          run(path.join(pgBin, "pg_ctl"), ["-D", dataDir, "-m", "immediate", "-w", "stop"]);
        } catch (error) {
          console.error(`Unable to stop scratch PostgreSQL cleanly: ${error.message}`);
        }
      }
      rmSync(scratchDir, { recursive: true, force: true });
    }
    delete process.env.DATABASE_URL;
  }
}, { timeout: 30_000 });

import { pathToFileURL } from "node:url";

test("Scenario 1: Term 1 partial and remaining payments, then Terms 2 and 3", async () => {
  const { pupil, enrollment, terms } = await setupPupil(2028, "Scenario One");
  const [term1, term2, term3] = terms;
  const firstCharge = await charge(enrollment.id, term1.id, 600_000, "s1-t1");
  const firstPayment = await pay(pupil.id, firstCharge.id, 200_000, "s1-partial");
  const remainingPayment = await pay(pupil.id, firstCharge.id, 400_000, "s1-remainder");
  const secondCharge = await charge(enrollment.id, term2.id, 450_000, "s1-t2");
  const secondPayment = await pay(pupil.id, secondCharge.id, 450_000, "s1-term2");
  const thirdCharge = await charge(enrollment.id, term3.id, 500_000, "s1-t3");
  const thirdPayment = await pay(pupil.id, thirdCharge.id, 500_000, "s1-term3");

  for (const [term, expectedPayments, expectedIds] of [
    [term1, [200_000, 400_000], [firstPayment, remainingPayment]],
    [term2, [450_000], [secondPayment]],
    [term3, [500_000], [thirdPayment]],
  ]) {
    const statement = await academic.getTermFeeStatement(term.id);
    assert.equal(statement.rows.length, 1);
    assert.deepEqual(statement.rows[0].payments.map((item) => item.amount), expectedPayments);
    assert.deepEqual(statement.rows[0].payments.map((item) => item.paymentId), expectedIds.map((item) => item.id));
    assert.ok(statement.rows[0].payments.every((item) => item.paidOn && item.receiptNumber));
  }
});

test("Scenario 2: Term 1 outstanding carries into the Term 2 statement", async () => {
  const { pupil, enrollment, terms } = await setupPupil(2029, "Scenario Two");
  const [term1, term2] = terms;
  const oldCharge = await charge(enrollment.id, term1.id, 300_000, "s2-t1");
  await pay(pupil.id, oldCharge.id, 120_000, "s2-partial");
  await charge(enrollment.id, term2.id, 340_000, "s2-t2");

  const statement = await academic.getTermFeeStatement(term2.id);
  assert.equal(statement.pupils[0].previousOutstanding, 180_000);
  assert.equal(statement.pupils[0].currentCharges, 340_000);
  assert.equal(statement.pupils[0].totalDue, 520_000);
  assert.equal(statement.rows[0].outstanding, 340_000);
});

test("Scenario 3: Mid-Term 2 departure retains records and blocks Term 3 fees", async () => {
  const { pupil, enrollment, terms } = await setupPupil(2030, "Scenario Three");
  const [term1, term2, term3] = terms;
  const oldCharge = await charge(enrollment.id, term1.id, 90_000, "s3-t1");
  const term2Charge = await charge(enrollment.id, term2.id, 210_000, "s3-t2");
  const term2Payment = await pay(pupil.id, term2Charge.id, 60_000, "s3-t2-payment");
  await academic.withdrawEnrollment({
    enrollmentId: enrollment.id,
    kind: "withdrawn",
    leavingOn: "2030-06-15",
    reason: "Family relocation",
    actorId,
  });

  const [{ rows: pupilRows }, { rows: enrollmentRows }] = await Promise.all([
    pool.query("SELECT status FROM students WHERE id = $1", [pupil.id]),
    pool.query("SELECT status FROM academic_enrollments WHERE id = $1", [enrollment.id]),
  ]);
  assert.equal(pupilRows[0].status, "inactive");
  assert.equal(enrollmentRows[0].status, "withdrawn");
  const history = await academic.getStudentAcademicHistory(pupil.id);
  assert.equal(history.charges.length, 2);
  assert.equal(history.charges.find((item) => item.id === oldCharge.id).amount, "90000.00");
  assert.equal(history.charges.find((item) => item.id === term2Charge.id).payments[0].paymentId, term2Payment.id);
  assert.equal(history.charges.find((item) => item.id === term2Charge.id).paid, 60_000);
  assert.equal((await academic.getTermFeeStatement(term2.id)).rows[0].outstanding, 150_000);
  await assert.rejects(
    charge(enrollment.id, term3.id, 220_000, "s3-forbidden-t3"),
    /inactive or former enrollment/,
  );
  const { rows: term3Charges } = await pool.query(
    "SELECT id FROM academic_fee_charges WHERE enrollment_id = $1 AND term_id = $2",
    [enrollment.id, term3.id],
  );
  assert.equal(term3Charges.length, 0);
});

test("Scenario 4: Transfer leaves unpaid balance on the pupil's original history", async () => {
  const { pupil, enrollment, terms } = await setupPupil(2031, "Scenario Four");
  const originalCharge = await charge(enrollment.id, terms[0].id, 400_000, "s4-t1");
  await pay(pupil.id, originalCharge.id, 150_000, "s4-partial");
  await academic.withdrawEnrollment({
    enrollmentId: enrollment.id,
    kind: "transferred",
    leavingOn: "2031-05-20",
    reason: "Transfer to another school",
    destinationSchool: "Synthetic Destination School",
    actorId,
  });

  const statement = await academic.getTermFeeStatement(terms[0].id);
  assert.equal(statement.rows[0].chargeId, originalCharge.id);
  assert.equal(statement.rows[0].studentId, pupil.id);
  assert.equal(statement.rows[0].outstanding, 250_000);
  const history = await academic.getStudentAcademicHistory(pupil.id);
  assert.equal(history.enrollments[0].status, "transferred");
  assert.equal(history.charges[0].id, originalCharge.id);
  assert.equal(history.charges[0].paid, 150_000);
  assert.equal(history.departures[0].kind, "transferred");
});

test("Scenario 5: Post-transfer payment reduces the original charge", async () => {
  const { pupil, enrollment, terms } = await setupPupil(2032, "Scenario Five");
  const originalCharge = await charge(enrollment.id, terms[0].id, 325_000, "s5-t1");
  await pay(pupil.id, originalCharge.id, 125_000, "s5-before-transfer");
  await academic.withdrawEnrollment({
    enrollmentId: enrollment.id,
    kind: "transferred",
    leavingOn: "2032-05-20",
    reason: "Transfer to another school",
    actorId,
  });

  const settlement = await pay(pupil.id, originalCharge.id, 200_000, "s5-after-transfer");
  assert.equal(settlement.chargeId, originalCharge.id);
  assert.equal(settlement.studentId, pupil.id);
  assert.equal(settlement.remainingBalance, 0);
  const statement = await academic.getTermFeeStatement(terms[0].id);
  assert.equal(statement.rows[0].chargeId, originalCharge.id);
  assert.equal(statement.rows[0].paid, 325_000);
  assert.equal(statement.rows[0].outstanding, 0);
});

test("Scenarios 6 and 7: Promotion to P4 and repetition preserve pupil and year history", async () => {
  const year = await academic.createAcademicYear(2026, actorId);
  const { rows: sourceTerms } = await pool.query(
    "SELECT id, number FROM academic_terms WHERE academic_year_id = $1 ORDER BY number",
    [year.id],
  );
  const promoted = await addStudent("Scenario Six");
  const repeated = await addStudent("Scenario Seven");
  const promotedEnrollment = await academic.createEnrollment({
    yearId: year.id, studentId: promoted.id, className: "P3", stream: "A", enrolledOn: "2026-02-01",
  });
  const repeatedEnrollment = await academic.createEnrollment({
    yearId: year.id, studentId: repeated.id, className: "P3", stream: "A", enrolledOn: "2026-02-01",
  });
  const oldCharge = await charge(promotedEnrollment.id, sourceTerms[0].id, 500_000, "s6-2026");
  await charge(repeatedEnrollment.id, sourceTerms[0].id, 500_000, "s7-2026");
  await pool.query("UPDATE academic_terms SET status = 'closed' WHERE id = $1", [sourceTerms[2].id]);

  const cycle = await academic.createPromotionCycle(year.id, 2027, actorId);
  await academic.updatePromotionDecision({
    cycleId: cycle.id, enrollmentId: promotedEnrollment.id, decision: "promote",
    nextClassName: "P4", nextStream: "A", approvalNotes: "Synthetic promotion", actorId,
  });
  await academic.updatePromotionDecision({
    cycleId: cycle.id, enrollmentId: repeatedEnrollment.id, decision: "repeat",
    nextClassName: "P3", nextStream: "A", approvalNotes: "Synthetic repetition", actorId,
  });
  const confirmation = await academic.confirmPromotionCycle(cycle.id, actorId);
  assert.equal(confirmation.createdEnrollments, 2);

  const { rows: nextEnrollments } = await pool.query(
    `SELECT academic_enrollments.*, students.registration_number
       FROM academic_enrollments
       JOIN students ON students.id = academic_enrollments.student_id
      WHERE academic_enrollments.academic_year_id = $1
      ORDER BY students.first_name`,
    [cycle.toYearId],
  );
  const promotedNext = nextEnrollments.find((row) => row.student_id === promoted.id);
  const repeatedNext = nextEnrollments.find((row) => row.student_id === repeated.id);
  assert.equal(promotedNext.class_name, "P4");
  assert.equal(promotedNext.student_id, promoted.id);
  assert.equal(promotedNext.registration_number, promoted.registration_number);
  assert.equal(repeatedNext.class_name, "P3");
  assert.equal(repeatedNext.student_id, repeated.id);
  assert.equal(repeatedNext.repeating, true);

  const history = await academic.getStudentAcademicHistory(promoted.id);
  assert.equal(history.enrollments.find((row) => row.year === 2026).className, "P3");
  assert.equal(history.enrollments.find((row) => row.year === 2027).className, "P4");
  assert.equal(history.charges.find((row) => row.id === oldCharge.id).academicYearId, year.id);
  const repeatHistory = await academic.getStudentAcademicHistory(repeated.id);
  assert.equal(repeatHistory.enrollments.find((row) => row.year === 2026).className, "P3");
  assert.equal(repeatHistory.enrollments.find((row) => row.year === 2027).className, "P3");
  assert.equal(repeatHistory.enrollments.find((row) => row.year === 2027).repeating, true);

  const nextYearTerm = await pool.query(
    "SELECT id FROM academic_terms WHERE academic_year_id = $1 AND number = 1",
    [cycle.toYearId],
  );
  await academic.upsertTermFeeSchedule({
    termId: nextYearTerm.rows[0].id, className: "P4", stream: "A", enrollmentType: "day",
    category: "Tuition", amount: 550_000, description: "Synthetic 2027 P4 tuition", actorId,
  });
  await academic.upsertTermFeeSchedule({
    termId: nextYearTerm.rows[0].id, className: "P3", stream: "A", enrollmentType: "day",
    category: "Tuition", amount: 500_000, description: "Synthetic 2027 P3 repeating tuition", actorId,
  });
  const opened = await academic.openAcademicTerm(nextYearTerm.rows[0].id, {
    startsOn: "2027-02-01", endsOn: "2027-04-30",
  }, actorId);
  assert.equal(opened.createdCharges, 2);
  const { rows: nextCharges } = await pool.query(
    "SELECT student_id, amount FROM academic_fee_charges WHERE term_id = $1",
    [nextYearTerm.rows[0].id],
  );
  assert.equal(Number(nextCharges.find((row) => row.student_id === promoted.id).amount), 550_000);
  assert.equal(Number(nextCharges.find((row) => row.student_id === repeated.id).amount), 500_000);
});

test("Scenario 8: A returning transfer reuses the pupil profile and registration", async () => {
  const { pupil, enrollment } = await setupPupil(2035, "Scenario Eight");
  await academic.withdrawEnrollment({
    enrollmentId: enrollment.id,
    kind: "transferred",
    leavingOn: "2035-05-20",
    reason: "Temporary family relocation",
    actorId,
  });
  const nextYear = await academic.createAcademicYear(2036, actorId);
  const returnedEnrollment = await academic.createEnrollment({
    yearId: nextYear.id,
    studentId: pupil.id,
    className: "P4",
    stream: "A",
    enrolledOn: "2036-02-01",
  });
  const [{ rows: profileRows }, { rows: enrollmentRows }] = await Promise.all([
    pool.query("SELECT id, registration_number, status FROM students WHERE id = $1", [pupil.id]),
    pool.query(
      "SELECT academic_year_id, status, class_name FROM academic_enrollments WHERE student_id = $1 ORDER BY academic_year_id",
      [pupil.id],
    ),
  ]);
  assert.equal(profileRows.length, 1);
  assert.equal(profileRows[0].id, pupil.id);
  assert.equal(profileRows[0].registration_number, pupil.registration_number);
  assert.equal(profileRows[0].status, "active");
  assert.equal(enrollmentRows.length, 2);
  assert.equal(enrollmentRows.find((row) => row.academic_year_id === enrollment.academicYearId).status, "transferred");
  assert.equal(enrollmentRows.find((row) => row.academic_year_id === nextYear.id).status, "active");
  assert.equal(returnedEnrollment.studentId, pupil.id);
});

test("Scenario 9: Planned term dates are editable until charges exist", async () => {
  const { enrollment, terms } = await setupPupil(2040, "Scenario Nine");
  const [, term2, term3] = terms;
  const updated = await academic.updatePlannedAcademicTermDates(term3.id, {
    startsOn: "2040-09-14", endsOn: "2040-11-30",
  });
  assert.equal(updated.status, "planned");
  const { rows: savedDates } = await pool.query(
    "SELECT starts_on::text, ends_on::text FROM academic_terms WHERE id = $1",
    [term3.id],
  );
  assert.deepEqual(savedDates[0], { starts_on: "2040-09-14", ends_on: "2040-11-30" });
  await assert.rejects(
    academic.updatePlannedAcademicTermDates(term2.id, { startsOn: "2040-10-01", endsOn: "2040-10-31" }),
    /overlap another planned or open term/,
  );
  await charge(enrollment.id, term3.id, 100_000, "s9-t3");
  await assert.rejects(
    academic.updatePlannedAcademicTermDates(term3.id, { startsOn: "2040-09-15", endsOn: "2040-11-30" }),
    /after fee charges have been created/,
  );
});