ALTER TABLE "inventory_item" RENAME TO "item";--> statement-breakpoint
ALTER TABLE "history_entry" RENAME CONSTRAINT "history_entry_item_id_inventory_item_id_fkey" TO "history_entry_item_id_item_id_fkey";--> statement-breakpoint
ALTER TABLE "stock" RENAME CONSTRAINT "stock_item_id_inventory_item_id_fkey" TO "stock_item_id_item_id_fkey";--> statement-breakpoint
-- Everything in the catalog so far is an Inventory Item.
ALTER TABLE "item" ADD COLUMN "kind" text NOT NULL DEFAULT 'inventory';--> statement-breakpoint
ALTER TABLE "item" ALTER COLUMN "kind" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "history_entry" ADD CONSTRAINT "history_entry_given_away_says_to_whom" CHECK ("reason" is distinct from 'given-away' or "note" is not null);
