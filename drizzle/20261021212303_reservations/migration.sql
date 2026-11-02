CREATE TABLE "line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"reserved" integer NOT NULL,
	"return_done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "line_reserved_positive" CHECK ("reserved" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "line_one_per_item" ON "line" ("event_id","item_id");--> statement-breakpoint
CREATE INDEX "line_item_id_index" ON "line" ("item_id");--> statement-breakpoint
ALTER TABLE "line" ADD CONSTRAINT "line_event_id_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id");--> statement-breakpoint
ALTER TABLE "line" ADD CONSTRAINT "line_item_id_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id");