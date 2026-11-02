ALTER TABLE "line" ADD COLUMN "added_by_user_id" text;--> statement-breakpoint
CREATE INDEX "line_added_by_user_id_index" ON "line" ("added_by_user_id");