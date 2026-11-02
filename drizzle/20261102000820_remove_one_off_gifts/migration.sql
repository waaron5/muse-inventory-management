-- Stop rather than lose a One-off Gift, should one still exist (ADR 0015).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "line" WHERE "kind" = 'one-off-gift') THEN
    RAISE EXCEPTION 'One-off Gift Lines still exist; they need a decision before this migration can run.';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "line" DROP CONSTRAINT "line_note_only_on_a_one_off_gift";--> statement-breakpoint
ALTER TABLE "line" DROP COLUMN "note";