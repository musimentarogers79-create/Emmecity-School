CREATE TABLE "academic_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"authorized_by" uuid NOT NULL,
	"adjusted_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_adjustment_kind_valid" CHECK ("academic_adjustments"."kind" in ('waiver', 'write_off', 'credit', 'refund', 'correction')),
	CONSTRAINT "academic_adjustment_amount_positive" CHECK ("academic_adjustments"."amount" > 0),
	CONSTRAINT "academic_adjustment_reason_nonblank" CHECK (length(btrim("academic_adjustments"."reason")) >= 3)
);
--> statement-breakpoint
CREATE TABLE "academic_departures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"leaving_on" date NOT NULL,
	"reason" text NOT NULL,
	"destination_school" text,
	"remarks" text DEFAULT '' NOT NULL,
	"processed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_departure_kind_valid" CHECK ("academic_departures"."kind" in ('transferred', 'withdrawn')),
	CONSTRAINT "academic_departure_reason_nonblank" CHECK (length(btrim("academic_departures"."reason")) >= 3)
);
--> statement-breakpoint
CREATE TABLE "academic_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"class_name" text NOT NULL,
	"stream" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"decision" text,
	"repeating" boolean DEFAULT false NOT NULL,
	"enrolled_on" date NOT NULL,
	"ended_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_enrollment_status_valid" CHECK ("academic_enrollments"."status" in ('active', 'completed', 'transferred', 'withdrawn', 'graduated')),
	CONSTRAINT "academic_enrollment_decision_valid" CHECK ("academic_enrollments"."decision" is null or "academic_enrollments"."decision" in ('promote', 'repeat', 'transfer', 'withdraw', 'graduate', 'hold'))
);
--> statement-breakpoint
CREATE TABLE "academic_fee_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"category" text DEFAULT 'tuition' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_fee_amount_nonnegative" CHECK ("academic_fee_charges"."amount" >= 0),
	CONSTRAINT "academic_fee_category_nonblank" CHECK (length(btrim("academic_fee_charges"."category")) > 0),
	CONSTRAINT "academic_fee_idempotency_nonblank" CHECK (length(btrim("academic_fee_charges"."idempotency_key")) > 0)
);
--> statement-breakpoint
CREATE TABLE "academic_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"idempotency_key" text NOT NULL,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_payment_allocation_positive" CHECK ("academic_payment_allocations"."amount" > 0),
	CONSTRAINT "academic_payment_idempotency_nonblank" CHECK (length(btrim("academic_payment_allocations"."idempotency_key")) > 0)
);
--> statement-breakpoint
CREATE TABLE "academic_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_term_number_valid" CHECK ("academic_terms"."number" between 1 and 3),
	CONSTRAINT "academic_term_status_valid" CHECK ("academic_terms"."status" in ('planned', 'open', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_year_status_valid" CHECK ("academic_years"."status" in ('draft', 'current', 'closed')),
	CONSTRAINT "academic_year_year_valid" CHECK ("academic_years"."year" between 1900 and 2200)
);
--> statement-breakpoint
CREATE TABLE "academic_promotion_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"from_year_id" uuid NOT NULL,
	"to_year_id" uuid NOT NULL,
	"status" text DEFAULT 'review' NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_promotion_status_valid" CHECK ("academic_promotion_cycles"."status" in ('review', 'confirmed'))
);
--> statement-breakpoint
CREATE TABLE "academic_promotion_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"next_class_name" text,
	"next_stream" text,
	"recommendation" text DEFAULT '' NOT NULL,
	"approval_notes" text DEFAULT '' NOT NULL,
	"reviewed_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_promotion_decision_valid" CHECK ("academic_promotion_decisions"."decision" in ('promote', 'repeat', 'transfer', 'withdraw', 'graduate', 'hold'))
);
--> statement-breakpoint
ALTER TABLE "academic_adjustments" ADD CONSTRAINT "academic_adjustments_school_id_school_settings_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_adjustments" ADD CONSTRAINT "academic_adjustments_charge_id_academic_fee_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."academic_fee_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_adjustments" ADD CONSTRAINT "academic_adjustments_authorized_by_school_users_id_fk" FOREIGN KEY ("authorized_by") REFERENCES "public"."school_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_departures" ADD CONSTRAINT "academic_departures_school_id_school_settings_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_departures" ADD CONSTRAINT "academic_departures_enrollment_id_academic_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."academic_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_departures" ADD CONSTRAINT "academic_departures_processed_by_school_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."school_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_enrollments" ADD CONSTRAINT "academic_enrollments_school_id_school_settings_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_enrollments" ADD CONSTRAINT "academic_enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_enrollments" ADD CONSTRAINT "academic_enrollments_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_fee_charges" ADD CONSTRAINT "academic_fee_charges_school_id_school_settings_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_fee_charges" ADD CONSTRAINT "academic_fee_charges_enrollment_id_academic_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."academic_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_fee_charges" ADD CONSTRAINT "academic_fee_charges_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_fee_charges" ADD CONSTRAINT "academic_fee_charges_created_by_school_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."school_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ADD CONSTRAINT "academic_payment_allocations_school_id_school_settings_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ADD CONSTRAINT "academic_payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ADD CONSTRAINT "academic_payment_allocations_charge_id_academic_fee_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."academic_fee_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_payment_allocations" ADD CONSTRAINT "academic_payment_allocations_recorded_by_school_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."school_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_school_id_school_settings_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_school_id_school_settings_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_created_by_school_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."school_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_promotion_cycles" ADD CONSTRAINT "academic_promotion_cycles_school_id_school_settings_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_promotion_cycles" ADD CONSTRAINT "academic_promotion_cycles_from_year_id_academic_years_id_fk" FOREIGN KEY ("from_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_promotion_cycles" ADD CONSTRAINT "academic_promotion_cycles_to_year_id_academic_years_id_fk" FOREIGN KEY ("to_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_promotion_cycles" ADD CONSTRAINT "academic_promotion_cycles_confirmed_by_school_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."school_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_promotion_decisions" ADD CONSTRAINT "academic_promotion_decisions_school_id_school_settings_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_promotion_decisions" ADD CONSTRAINT "academic_promotion_decisions_cycle_id_academic_promotion_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."academic_promotion_cycles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_promotion_decisions" ADD CONSTRAINT "academic_promotion_decisions_enrollment_id_academic_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."academic_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_promotion_decisions" ADD CONSTRAINT "academic_promotion_decisions_reviewed_by_school_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."school_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_adjustment_charge_idx" ON "academic_adjustments" USING btree ("school_id","charge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_departure_enrollment_idx" ON "academic_departures" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_enrollment_student_year_idx" ON "academic_enrollments" USING btree ("school_id","student_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "academic_enrollment_year_status_idx" ON "academic_enrollments" USING btree ("school_id","academic_year_id","status");--> statement-breakpoint
CREATE INDEX "academic_enrollment_student_idx" ON "academic_enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_fee_enrollment_term_category_idx" ON "academic_fee_charges" USING btree ("enrollment_id","term_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_fee_idempotency_idx" ON "academic_fee_charges" USING btree ("school_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "academic_fee_term_idx" ON "academic_fee_charges" USING btree ("school_id","term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_payment_charge_once_idx" ON "academic_payment_allocations" USING btree ("payment_id","charge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_payment_idempotency_idx" ON "academic_payment_allocations" USING btree ("school_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "academic_payment_charge_idx" ON "academic_payment_allocations" USING btree ("school_id","charge_id");--> statement-breakpoint
CREATE INDEX "academic_payment_payment_idx" ON "academic_payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_term_year_number_idx" ON "academic_terms" USING btree ("school_id","academic_year_id","number");--> statement-breakpoint
CREATE INDEX "academic_term_school_status_idx" ON "academic_terms" USING btree ("school_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_year_school_year_idx" ON "academic_years" USING btree ("school_id","year");--> statement-breakpoint
CREATE INDEX "academic_year_school_status_idx" ON "academic_years" USING btree ("school_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_promotion_cycle_once_idx" ON "academic_promotion_cycles" USING btree ("school_id","from_year_id","to_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_promotion_decision_once_idx" ON "academic_promotion_decisions" USING btree ("cycle_id","enrollment_id");