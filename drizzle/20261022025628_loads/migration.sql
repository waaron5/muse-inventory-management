ALTER TABLE "history_entry" ADD COLUMN "line_id" uuid;--> statement-breakpoint
ALTER TABLE "history_entry" ADD COLUMN "corrects_id" uuid;--> statement-breakpoint
CREATE INDEX "history_entry_line_id_index" ON "history_entry" ("line_id");--> statement-breakpoint
CREATE INDEX "history_entry_corrects_id_index" ON "history_entry" ("corrects_id");--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_line_id_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "line"("id");--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_corrects_id_history_entry_id_fkey" FOREIGN KEY ("corrects_id") REFERENCES "history_entry"("id");--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_load_leaves_a_location" CHECK ("kind" <> 'load' or ("line_id" is not null and "from_location_id" is not null and "to_location_id" is null));--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_load_correction_puts_back" CHECK ("kind" <> 'load-correction' or ("line_id" is not null and "corrects_id" is not null and "to_location_id" is not null and "from_location_id" is null));