ALTER TABLE "attendance" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "deletion_reason" text;