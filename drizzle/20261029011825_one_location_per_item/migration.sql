-- One Location per item (ADR 0014). Empty balances beside a stocked one, or
-- beside another empty one, go; they hold nothing and explain nothing.
DELETE FROM "stock" AS s
WHERE s."count" = 0 AND EXISTS (
  SELECT 1 FROM "stock" AS other
  WHERE other."item_id" = s."item_id"
    AND (other."count" > 0 OR (other."count" = 0 AND other."location_id" < s."location_id"))
);
--> statement-breakpoint
-- Stock still split across Locations needs a person to say where it all is.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "stock" GROUP BY "item_id" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Some items hold Stock at more than one Location. Move each one''s Stock to a single Location, then migrate again.';
  END IF;
END $$;
--> statement-breakpoint
-- An item with no balance sits Unassigned, with none.
INSERT INTO "location" ("id", "name")
SELECT '00000000-0000-4000-8000-000000000000', 'Unassigned'
WHERE EXISTS (SELECT 1 FROM "item" AS i WHERE NOT EXISTS (SELECT 1 FROM "stock" AS s WHERE s."item_id" = i."id"))
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "stock" ("item_id", "location_id", "count")
SELECT i."id", '00000000-0000-4000-8000-000000000000', 0
FROM "item" AS i
WHERE NOT EXISTS (SELECT 1 FROM "stock" AS s WHERE s."item_id" = i."id");
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_one_location_per_item" ON "stock" ("item_id");
