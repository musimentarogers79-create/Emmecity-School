import { pool } from "@workspace/db";

export type AcademicSchemaState = "ready" | "missing" | "partial";

const cache = new Map<string, { checkedAt: number; state: AcademicSchemaState }>();
const cacheTtlMs = 5_000;

const enrollmentTables = ["academic_enrollments"] as const;
const paymentAllocationTables = ["academic_payment_allocations"] as const;
const feeChargeTables = ["academic_enrollments", "academic_fee_charges"] as const;
const ledgerTables = [
  "academic_payment_allocations",
  "academic_fee_charges",
  "academic_terms",
  "academic_years",
  "academic_adjustments",
] as const;
const workspaceTables = [
  "academic_years",
  "academic_terms",
  "academic_enrollments",
  "academic_fee_schedules",
  "academic_fee_charges",
  "academic_payment_allocations",
  "academic_adjustments",
  "academic_departures",
  "academic_promotion_cycles",
  "academic_promotion_decisions",
] as const;

async function checkTables(tables: readonly string[]): Promise<AcademicSchemaState> {
  const key = tables.join(",");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.checkedAt < cacheTtlMs) return cached.state;

  const result = await pool.query<{ table_name: string; available: boolean }>(
    `SELECT table_name, to_regclass('public.' || table_name) IS NOT NULL AS available
     FROM unnest($1::text[]) AS required(table_name)`,
    [[...tables]],
  );
  const availableCount = result.rows.filter((row) => row.available).length;
  const state: AcademicSchemaState = availableCount === 0
    ? "missing"
    : availableCount === tables.length
      ? "ready"
      : "partial";
  cache.set(key, { checkedAt: Date.now(), state });
  return state;
}

export const academicEnrollmentSchemaState = () => checkTables(enrollmentTables);
export const academicPaymentAllocationSchemaState = () => checkTables(paymentAllocationTables);
export const academicFeeChargeSchemaState = () => checkTables(feeChargeTables);
export const academicLedgerSchemaState = () => checkTables(ledgerTables);
export const academicWorkspaceSchemaState = () => checkTables(workspaceTables);