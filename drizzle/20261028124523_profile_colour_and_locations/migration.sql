ALTER TABLE "user" ADD COLUMN "avatar_colour_choice" integer;--> statement-breakpoint
-- Keep all Locations and their Stock; existing archived Locations become available again.
ALTER TABLE "location" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_avatar_colour_choice" CHECK ("avatar_colour_choice" between 0 and 11);
