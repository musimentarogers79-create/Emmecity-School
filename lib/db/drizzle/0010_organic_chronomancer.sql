ALTER TABLE "school_users" DROP CONSTRAINT "school_users_role_valid";--> statement-breakpoint
ALTER TABLE "school_users" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "school_users" ADD CONSTRAINT "school_users_status_valid" CHECK ("school_users"."status" in ('active', 'inactive'));--> statement-breakpoint
ALTER TABLE "school_users" ADD CONSTRAINT "school_users_role_valid" CHECK ("school_users"."role" in ('super_admin', 'administrator', 'teacher', 'accountant', 'secretary', 'librarian', 'nurse', 'guardian', 'student', 'staff'));