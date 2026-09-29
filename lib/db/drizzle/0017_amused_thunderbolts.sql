DROP INDEX "academic_payment_charge_once_idx";
--> statement-breakpoint
DROP INDEX "academic_fee_enrollment_term_category_idx";
--> statement-breakpoint
ALTER TABLE "academic_fee_charges" ADD COLUMN "student_id" uuid;
--> statement-breakpoint
ALTER TABLE "academic_fee_charges" ADD COLUMN "academic_year_id" uuid;
--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ADD COLUMN "student_id" uuid;
--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ADD COLUMN "academic_year_id" uuid;
--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ADD COLUMN "term_id" uuid;
--> statement-breakpoint
UPDATE "academic_fee_charges" AS charge
SET "student_id" = enrollment."student_id", "academic_year_id" = enrollment."academic_year_id"
FROM "academic_enrollments" AS enrollment
WHERE charge."enrollment_id" = enrollment."id";
--> statement-breakpoint
UPDATE "academic_payment_allocations" AS allocation
SET "student_id" = payment."student_id",
    "academic_year_id" = charge."academic_year_id",
    "term_id" = charge."term_id"
FROM "payments" AS payment, "academic_fee_charges" AS charge
WHERE allocation."payment_id" = payment."id"
  AND allocation."charge_id" = charge."id";
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "academic_fee_charges" WHERE "student_id" IS NULL OR "academic_year_id" IS NULL)
    OR EXISTS (SELECT 1 FROM "academic_payment_allocations" WHERE "student_id" IS NULL OR "academic_year_id" IS NULL OR "term_id" IS NULL) THEN
    RAISE EXCEPTION 'Academic tenant backfill found orphaned charge or payment-allocation records; resolve them before retrying migration 0017';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "academic_fee_charges" ALTER COLUMN "student_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "academic_fee_charges" ALTER COLUMN "academic_year_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ALTER COLUMN "student_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ALTER COLUMN "academic_year_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ALTER COLUMN "term_id" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_enrollment_school_id_idx" ON "academic_enrollments" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_enrollment_school_id_student_year_idx" ON "academic_enrollments" USING btree ("school_id","id","student_id","academic_year_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_fee_school_id_idx" ON "academic_fee_charges" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_fee_school_id_student_year_term_idx" ON "academic_fee_charges" USING btree ("school_id","id","student_id","academic_year_id","term_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_term_school_id_year_idx" ON "academic_terms" USING btree ("school_id","id","academic_year_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_year_school_id_idx" ON "academic_years" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "payments_school_id_student_idx" ON "payments" USING btree ("school_id","id","student_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_promotion_cycle_school_id_idx" ON "academic_promotion_cycles" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "students_school_id_ordered_idx" ON "students" USING btree ("school_id","id");
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM "academic_fee_charges"
    GROUP BY "enrollment_id", "term_id", lower(regexp_replace(btrim("category"), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Normalized duplicate fee categories exist for an enrollment and term; reconcile them before retrying migration 0017';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_fee_enrollment_term_category_idx" ON "academic_fee_charges" USING btree ("enrollment_id","term_id",lower(regexp_replace(btrim("category"), '[[:space:]]+', ' ', 'g')));
--> statement-breakpoint
ALTER TABLE "academic_adjustments" ADD CONSTRAINT "academic_adjustment_school_charge_fk" FOREIGN KEY ("school_id","charge_id") REFERENCES "public"."academic_fee_charges"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_departures" ADD CONSTRAINT "academic_departure_school_enrollment_fk" FOREIGN KEY ("school_id","enrollment_id") REFERENCES "public"."academic_enrollments"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_enrollments" ADD CONSTRAINT "academic_enrollment_school_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "public"."students"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_enrollments" ADD CONSTRAINT "academic_enrollment_school_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "public"."academic_years"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_fee_charges" ADD CONSTRAINT "academic_fee_enrollment_tenant_fk" FOREIGN KEY ("school_id","enrollment_id","student_id","academic_year_id") REFERENCES "public"."academic_enrollments"("school_id","id","student_id","academic_year_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_fee_charges" ADD CONSTRAINT "academic_fee_term_year_fk" FOREIGN KEY ("school_id","term_id","academic_year_id") REFERENCES "public"."academic_terms"("school_id","id","academic_year_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ADD CONSTRAINT "academic_payment_school_pupil_fk" FOREIGN KEY ("school_id","payment_id","student_id") REFERENCES "public"."payments"("school_id","id","student_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ADD CONSTRAINT "academic_payment_charge_term_fk" FOREIGN KEY ("school_id","charge_id","student_id","academic_year_id","term_id") REFERENCES "public"."academic_fee_charges"("school_id","id","student_id","academic_year_id","term_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ADD CONSTRAINT "academic_payment_school_term_fk" FOREIGN KEY ("school_id","term_id","academic_year_id") REFERENCES "public"."academic_terms"("school_id","id","academic_year_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_school_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "public"."academic_years"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_promotion_cycles" ADD CONSTRAINT "academic_promotion_from_year_tenant_fk" FOREIGN KEY ("school_id","from_year_id") REFERENCES "public"."academic_years"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_promotion_cycles" ADD CONSTRAINT "academic_promotion_to_year_tenant_fk" FOREIGN KEY ("school_id","to_year_id") REFERENCES "public"."academic_years"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_promotion_decisions" ADD CONSTRAINT "academic_promotion_decision_cycle_tenant_fk" FOREIGN KEY ("school_id","cycle_id") REFERENCES "public"."academic_promotion_cycles"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_promotion_decisions" ADD CONSTRAINT "academic_promotion_decision_enrollment_tenant_fk" FOREIGN KEY ("school_id","enrollment_id") REFERENCES "public"."academic_enrollments"("school_id","id") ON DELETE restrict ON UPDATE no action;