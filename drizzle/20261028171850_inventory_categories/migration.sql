CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "category_id" uuid;--> statement-breakpoint
CREATE INDEX "item_category_id_index" ON "item" ("category_id");--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_category_id_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_category_only_on_inventory" CHECK ("kind" = 'inventory' or "category_id" is null);
--> statement-breakpoint
-- Starter categories and the item-by-item assignments approved by Muse.
INSERT INTO "category" ("id", "name") VALUES
  ('98a7df06-ebdb-428f-961a-b8d1378fc7d2', 'Vases & Vessels'),
  ('60b2a416-bb1a-4d89-bb85-800a27056eb3', 'Furniture'),
  ('9435ee9a-2a0a-41ca-83db-d229a9866842', 'Umbrellas & Shade'),
  ('f73892c6-4a48-4bbe-9b25-6e5b3fb29172', 'Lighting & Candle Holders'),
  ('68538768-9fb2-4992-96c2-5bab5f213a73', 'Decor & Tabletop');
--> statement-breakpoint
-- IDs avoid accidentally assigning a different item with a similar name.
UPDATE "item" AS i SET "category_id" = approved.category_id
FROM (VALUES
  ('3751ab86-54ef-424e-8904-363ae6136d40'::uuid, '98a7df06-ebdb-428f-961a-b8d1378fc7d2'::uuid),
  ('a9566d80-7b47-411b-aec5-aec1b162a18f'::uuid, '98a7df06-ebdb-428f-961a-b8d1378fc7d2'::uuid),
  ('a2a244dc-8ac1-4683-991a-226846a9391c'::uuid, '98a7df06-ebdb-428f-961a-b8d1378fc7d2'::uuid),
  ('d27f0575-edf9-4e10-95c7-07683e82fa1d'::uuid, '60b2a416-bb1a-4d89-bb85-800a27056eb3'::uuid),
  ('b46c1b26-343c-4e74-a72f-a3f0d459496b'::uuid, '60b2a416-bb1a-4d89-bb85-800a27056eb3'::uuid),
  ('ad376176-b8a1-47a8-b99f-7f9e9e6ef13d'::uuid, '9435ee9a-2a0a-41ca-83db-d229a9866842'::uuid),
  ('28dbc9aa-7f49-4189-8258-abca091e30a7'::uuid, 'f73892c6-4a48-4bbe-9b25-6e5b3fb29172'::uuid),
  ('91963c10-41f9-4060-8f65-353948463efc'::uuid, 'f73892c6-4a48-4bbe-9b25-6e5b3fb29172'::uuid),
  ('c457c1c3-afaa-4c56-94a2-1f7cc5b75e59'::uuid, '68538768-9fb2-4992-96c2-5bab5f213a73'::uuid),
  ('fab18018-0fde-4e0d-bb52-ceea5b780f12'::uuid, '68538768-9fb2-4992-96c2-5bab5f213a73'::uuid),
  ('13ecd02e-ca06-4d1a-a02b-2a28aaa9f6ba'::uuid, '68538768-9fb2-4992-96c2-5bab5f213a73'::uuid)
) AS approved(item_id, category_id)
WHERE i."id" = approved.item_id AND i."kind" = 'inventory';
