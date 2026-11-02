CREATE TABLE "shortage_acknowledgement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"item_id" uuid NOT NULL,
	"note" text NOT NULL,
	"by_user_id" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shortage_acknowledgement_event" (
	"acknowledgement_id" uuid,
	"event_id" uuid,
	"short_by" integer NOT NULL,
	CONSTRAINT "shortage_acknowledgement_event_pkey" PRIMARY KEY("acknowledgement_id","event_id"),
	CONSTRAINT "shortage_acknowledgement_event_short" CHECK ("short_by" > 0)
);
--> statement-breakpoint
CREATE INDEX "shortage_acknowledgement_item_id_index" ON "shortage_acknowledgement" ("item_id");--> statement-breakpoint
CREATE INDEX "shortage_acknowledgement_by_user_id_index" ON "shortage_acknowledgement" ("by_user_id");--> statement-breakpoint
CREATE INDEX "shortage_acknowledgement_event_event_id_index" ON "shortage_acknowledgement_event" ("event_id");--> statement-breakpoint
ALTER TABLE "shortage_acknowledgement" ADD CONSTRAINT "shortage_acknowledgement_item_id_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id");--> statement-breakpoint
ALTER TABLE "shortage_acknowledgement" ADD CONSTRAINT "shortage_acknowledgement_by_user_id_user_id_fkey" FOREIGN KEY ("by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "shortage_acknowledgement_event" ADD CONSTRAINT "shortage_acknowledgement_event_RAVMWc3nX7yp_fkey" FOREIGN KEY ("acknowledgement_id") REFERENCES "shortage_acknowledgement"("id");--> statement-breakpoint
ALTER TABLE "shortage_acknowledgement_event" ADD CONSTRAINT "shortage_acknowledgement_event_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id");