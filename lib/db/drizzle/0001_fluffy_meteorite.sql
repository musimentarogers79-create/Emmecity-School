CREATE TABLE "school_login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_login_attempts_count_positive" CHECK ("school_login_attempts"."count" > 0)
);
--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_school_id_school_settings_id_fk";
--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_school_id_school_settings_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_student_id_students_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "school_login_attempts_key_idx" ON "school_login_attempts" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "school_login_attempts_reset_idx" ON "school_login_attempts" USING btree ("reset_at");--> statement-breakpoint
CREATE UNIQUE INDEX "students_school_id_idx" ON "students" USING btree ("school_id","id");--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_school_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "public"."students"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_school_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "public"."students"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_users" ADD CONSTRAINT "school_users_school_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "public"."students"("school_id","id") ON DELETE restrict ON UPDATE no action;