CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"client_id" uuid NOT NULL,
	"pl_code" text,
	"venue" text,
	"starts_on" date,
	"ends_on" date,
	"out_on" date,
	"return_on" date,
	"lead_user_id" text,
	"notes" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_ends_after_it_starts" CHECK ("ends_on" >= "starts_on"),
	CONSTRAINT "event_returns_after_it_goes_out" CHECK (coalesce("return_on", "ends_on") >= coalesce("out_on", "starts_on"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "client_name_unique" ON "client" (lower("name"));--> statement-breakpoint
CREATE INDEX "event_client_id_index" ON "event" ("client_id");--> statement-breakpoint
CREATE INDEX "event_lead_user_id_index" ON "event" ("lead_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_pl_code_unique" ON "event" (lower("pl_code"));--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_client_id_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id");--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_lead_user_id_user_id_fkey" FOREIGN KEY ("lead_user_id") REFERENCES "user"("id");