ALTER TABLE "line" RENAME COLUMN "return_done_at" TO "given_away_at";--> statement-breakpoint
ALTER TABLE "history_entry" DROP CONSTRAINT "history_entry_given_away_touches_no_location";--> statement-breakpoint
ALTER TABLE "event" DROP CONSTRAINT "event_returns_after_it_goes_out";--> statement-breakpoint
ALTER TABLE "line" RENAME CONSTRAINT "line_return_done_only_on_a_reservation" TO "line_given_away_only_on_a_reservation";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "out_on";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "return_on";--> statement-breakpoint
ALTER TABLE "history_entry" ALTER COLUMN "by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_given_away_lands_nowhere" CHECK ("kind" <> 'given-away' or ("line_id" is not null and "to_location_id" is null));--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_giveaway_correction_puts_back" CHECK ("kind" <> 'giveaway-correction' or ("line_id" is not null and "corrects_id" is not null and "to_location_id" is not null and "from_location_id" is null));--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_only_a_giveaway_is_by_nobody" CHECK ("by_user_id" is not null or "kind" = 'given-away');--> statement-breakpoint
ALTER TABLE "line" DROP CONSTRAINT "line_given_away_only_on_a_reservation", ADD CONSTRAINT "line_given_away_only_on_a_reservation" CHECK ("kind" = 'reservation' or "given_away_at" is null);