CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"by_user_id" text,
	"area" text NOT NULL,
	"sentence" jsonb NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activity_recorded_at_index" ON "activity" ("recorded_at");--> statement-breakpoint
CREATE INDEX "activity_by_user_id_recorded_at_index" ON "activity" ("by_user_id","recorded_at");--> statement-breakpoint
CREATE INDEX "activity_area_recorded_at_index" ON "activity" ("area","recorded_at");