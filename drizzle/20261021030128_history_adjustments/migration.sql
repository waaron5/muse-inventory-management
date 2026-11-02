ALTER TABLE "history_entry" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "history_entry" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_adjustment_has_reason" CHECK (("kind" = 'adjustment') = ("reason" is not null));