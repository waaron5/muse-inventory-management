ALTER TABLE "event" DROP CONSTRAINT "event_lead_user_id_user_id_fkey";--> statement-breakpoint
DROP INDEX "event_lead_user_id_index";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "lead_user_id";