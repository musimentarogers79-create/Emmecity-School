CREATE TABLE "payroll_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"period" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" text NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"receipt_number" text NOT NULL,
	"paid_on" date NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_payments_amount_positive" CHECK ("payroll_payments"."amount" > 0),
	CONSTRAINT "payroll_payments_period_nonblank" CHECK (length(btrim("payroll_payments"."period")) > 0),
	CONSTRAINT "payroll_payments_status_valid" CHECK ("payroll_payments"."status" in ('paid', 'reversed'))
);
--> statement-breakpoint
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_school_id_school_settings_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_school_staff_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."school_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_payments_receipt_idx" ON "payroll_payments" USING btree ("school_id","receipt_number");--> statement-breakpoint
CREATE INDEX "payroll_payments_staff_period_idx" ON "payroll_payments" USING btree ("school_id","staff_id","period");