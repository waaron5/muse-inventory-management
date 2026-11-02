CREATE TABLE "history_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"count" integer NOT NULL,
	"from_location_id" uuid,
	"to_location_id" uuid,
	"by_user_id" text NOT NULL,
	"happened_on" date NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "history_entry_count_positive" CHECK ("count" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"sku" text,
	"unit_price_cents" integer,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"item_id" uuid,
	"location_id" uuid,
	"count" integer NOT NULL,
	CONSTRAINT "stock_pkey" PRIMARY KEY("item_id","location_id"),
	CONSTRAINT "stock_count_never_negative" CHECK ("count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "history_entry_item_id_index" ON "history_entry" ("item_id");--> statement-breakpoint
CREATE INDEX "history_entry_from_location_id_index" ON "history_entry" ("from_location_id");--> statement-breakpoint
CREATE INDEX "history_entry_to_location_id_index" ON "history_entry" ("to_location_id");--> statement-breakpoint
CREATE INDEX "history_entry_by_user_id_index" ON "history_entry" ("by_user_id");--> statement-breakpoint
CREATE INDEX "stock_location_id_index" ON "stock" ("location_id");--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_item_id_inventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_item"("id");--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_from_location_id_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "location"("id");--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_to_location_id_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "location"("id");--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_by_user_id_user_id_fkey" FOREIGN KEY ("by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_item_id_inventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_item"("id");--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id");