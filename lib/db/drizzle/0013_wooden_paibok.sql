ALTER TABLE "payments" DROP CONSTRAINT "payments_amount_positive";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_nonnegative" CHECK ("payments"."amount" >= 0);