CREATE TABLE "past_use_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"item_id" uuid NOT NULL,
	"photo" uuid NOT NULL UNIQUE,
	"event_id" uuid,
	"note" text,
	"by_user_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "photo" uuid;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_photo_key" UNIQUE("photo");--> statement-breakpoint
CREATE INDEX "past_use_photo_item_id_index" ON "past_use_photo" ("item_id");--> statement-breakpoint
CREATE INDEX "past_use_photo_event_id_index" ON "past_use_photo" ("event_id");--> statement-breakpoint
CREATE INDEX "past_use_photo_by_user_id_index" ON "past_use_photo" ("by_user_id");--> statement-breakpoint
ALTER TABLE "past_use_photo" ADD CONSTRAINT "past_use_photo_item_id_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id");--> statement-breakpoint
ALTER TABLE "past_use_photo" ADD CONSTRAINT "past_use_photo_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id");--> statement-breakpoint
ALTER TABLE "past_use_photo" ADD CONSTRAINT "past_use_photo_by_user_id_user_id_fkey" FOREIGN KEY ("by_user_id") REFERENCES "user"("id");