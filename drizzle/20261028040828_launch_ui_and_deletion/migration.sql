CREATE TABLE "deleted_record" (
	"id" text PRIMARY KEY,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" DROP CONSTRAINT "event_client_id_client_id_fkey";--> statement-breakpoint
-- The catalog rename left different constraint names in earlier snapshots.
ALTER TABLE "history_entry" DROP CONSTRAINT IF EXISTS "history_entry_item_id_inventory_item_id_fkey";--> statement-breakpoint
ALTER TABLE "history_entry" DROP CONSTRAINT IF EXISTS "history_entry_item_id_item_id_fkey";--> statement-breakpoint
ALTER TABLE "history_entry" DROP CONSTRAINT "history_entry_from_location_id_location_id_fkey";--> statement-breakpoint
ALTER TABLE "history_entry" DROP CONSTRAINT "history_entry_to_location_id_location_id_fkey";--> statement-breakpoint
ALTER TABLE "history_entry" DROP CONSTRAINT "history_entry_line_id_line_id_fkey";--> statement-breakpoint
ALTER TABLE "history_entry" DROP CONSTRAINT "history_entry_by_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "line" DROP CONSTRAINT "line_item_id_item_id_fkey";--> statement-breakpoint
ALTER TABLE "past_use_photo" DROP CONSTRAINT "past_use_photo_event_id_event_id_fkey";--> statement-breakpoint
ALTER TABLE "past_use_photo" DROP CONSTRAINT "past_use_photo_by_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "shortage_acknowledgement" DROP CONSTRAINT "shortage_acknowledgement_by_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_colour" integer GENERATED ALWAYS AS IDENTITY (sequence name "user_avatar_colour_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_avatar_colour_key" UNIQUE("avatar_colour");
