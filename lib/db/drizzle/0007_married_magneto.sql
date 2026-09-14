CREATE INDEX "announcements_school_idx" ON "announcements" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "assignments_school_idx" ON "assignments" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "classes_school_idx" ON "classes" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "discipline_school_idx" ON "discipline" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "documents_school_idx" ON "documents" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "events_school_idx" ON "events" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "expenses_school_idx" ON "expenses" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "guardians_school_idx" ON "guardians" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "inventory_school_idx" ON "inventory" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "library_school_idx" ON "library" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "medical_school_idx" ON "medical" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "notifications_school_idx" ON "notifications" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "parents_school_idx" ON "parents" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "payments_school_paid_on_idx" ON "payments" USING btree ("school_id","paid_on");--> statement-breakpoint
CREATE INDEX "reports_school_idx" ON "reports" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "salary_payments_school_idx" ON "salary_payments" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "staff_school_idx" ON "staff" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "students_status_idx" ON "students" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "subjects_school_idx" ON "subjects" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "timetable_school_idx" ON "timetable" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "transport_school_idx" ON "transport" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "school_users_role_idx" ON "school_users" USING btree ("school_id","role");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_registration_nonblank" CHECK (length(btrim("students"."registration_number")) > 0);--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_status_valid" CHECK ("students"."status" in ('active', 'inactive'));--> statement-breakpoint
ALTER TABLE "school_users" ADD CONSTRAINT "school_users_identifier_nonblank" CHECK (length(btrim("school_users"."identifier")) > 0);--> statement-breakpoint
ALTER TABLE "school_users" ADD CONSTRAINT "school_users_user_type_valid" CHECK ("school_users"."user_type" in ('staff', 'guardian', 'learner'));--> statement-breakpoint
ALTER TABLE "school_users" ADD CONSTRAINT "school_users_role_valid" CHECK ("school_users"."role" in ('super_admin', 'administrator', 'teacher', 'accountant', 'guardian', 'student', 'staff'));