CREATE TABLE "academic_fee_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"class_name" text NOT NULL,
	"stream" text DEFAULT '' NOT NULL,
	"enrollment_type" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_fee_schedule_class_nonblank" CHECK (length(btrim("academic_fee_schedules"."class_name")) > 0),
	CONSTRAINT "academic_fee_schedule_amount_nonnegative" CHECK ("academic_fee_schedules"."amount" >= 0),
	CONSTRAINT "academic_fee_schedule_category_nonblank" CHECK (length(btrim("academic_fee_schedules"."category")) > 0),
	CONSTRAINT "academic_fee_schedule_enrollment_type_valid" CHECK ("academic_fee_schedules"."enrollment_type" in ('', 'day', 'boarding'))
);
--> statement-breakpoint
ALTER TABLE "academic_fee_schedules" ADD CONSTRAINT "academic_fee_schedules_school_id_school_settings_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_fee_schedules" ADD CONSTRAINT "academic_fee_schedules_created_by_school_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."school_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_fee_schedules" ADD CONSTRAINT "academic_fee_schedules_updated_by_school_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."school_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_fee_schedules" ADD CONSTRAINT "academic_fee_schedule_school_term_year_fk" FOREIGN KEY ("school_id","term_id","academic_year_id") REFERENCES "public"."academic_terms"("school_id","id","academic_year_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "academic_fee_schedule_identity_idx" ON "academic_fee_schedules" USING btree ("school_id","term_id",lower(regexp_replace(btrim("class_name"), '[[:space:]]+', ' ', 'g')),lower(regexp_replace(btrim("stream"), '[[:space:]]+', ' ', 'g')),lower(btrim("enrollment_type")),lower(regexp_replace(btrim("category"), '[[:space:]]+', ' ', 'g')));--> statement-breakpoint
CREATE INDEX "academic_fee_schedule_term_idx" ON "academic_fee_schedules" USING btree ("school_id","term_id");--> statement-breakpoint
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_term_date_range_valid" CHECK (("academic_terms"."starts_on" is null and "academic_terms"."ends_on" is null) or ("academic_terms"."starts_on" is not null and "academic_terms"."ends_on" is not null and "academic_terms"."starts_on" <= "academic_terms"."ends_on"));