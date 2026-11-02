ALTER TABLE "line" ADD COLUMN "kind" text DEFAULT 'reservation' NOT NULL;--> statement-breakpoint
ALTER TABLE "line" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "line" ADD COLUMN "lender" text;--> statement-breakpoint
ALTER TABLE "line" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "history_entry" ALTER COLUMN "item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "line" ALTER COLUMN "item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_only_a_check_off_names_no_item" CHECK ("item_id" is not null or ("line_id" is not null and "kind" in ('load', 'load-correction', 'return', 'return-correction', 'write-off')));--> statement-breakpoint
ALTER TABLE "line" ADD CONSTRAINT "line_reservation_names_an_item" CHECK (("kind" = 'reservation') = ("item_id" is not null));--> statement-breakpoint
ALTER TABLE "line" ADD CONSTRAINT "line_by_hand_is_named" CHECK (("kind" = 'reservation') = ("name" is null));--> statement-breakpoint
ALTER TABLE "line" ADD CONSTRAINT "line_borrowed_names_its_lender" CHECK (("kind" = 'borrowed') = ("lender" is not null));--> statement-breakpoint
ALTER TABLE "line" ADD CONSTRAINT "line_note_only_on_a_one_off_gift" CHECK ("kind" = 'one-off-gift' or "note" is null);--> statement-breakpoint
ALTER TABLE "line" ADD CONSTRAINT "line_return_done_only_on_a_reservation" CHECK ("kind" = 'reservation' or "return_done_at" is null);--> statement-breakpoint
ALTER TABLE "history_entry" DROP CONSTRAINT "history_entry_load_leaves_a_location", ADD CONSTRAINT "history_entry_load_leaves_a_location" CHECK ("kind" <> 'load' or ("line_id" is not null and ("from_location_id" is not null) = ("item_id" is not null) and "to_location_id" is null));--> statement-breakpoint
ALTER TABLE "history_entry" DROP CONSTRAINT "history_entry_load_correction_puts_back", ADD CONSTRAINT "history_entry_load_correction_puts_back" CHECK ("kind" <> 'load-correction' or ("line_id" is not null and "corrects_id" is not null and ("to_location_id" is not null) = ("item_id" is not null) and "from_location_id" is null));--> statement-breakpoint
ALTER TABLE "history_entry" DROP CONSTRAINT "history_entry_return_lands_in_a_location", ADD CONSTRAINT "history_entry_return_lands_in_a_location" CHECK ("kind" <> 'return' or ("line_id" is not null and ("to_location_id" is not null) = ("item_id" is not null) and "from_location_id" is null));--> statement-breakpoint
ALTER TABLE "history_entry" DROP CONSTRAINT "history_entry_return_correction_takes_back_out", ADD CONSTRAINT "history_entry_return_correction_takes_back_out" CHECK ("kind" <> 'return-correction' or ("line_id" is not null and "corrects_id" is not null and ("from_location_id" is not null) = ("item_id" is not null) and "to_location_id" is null));