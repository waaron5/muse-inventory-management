ALTER TABLE "client" ALTER COLUMN "colour" SET DEFAULT 'blue';--> statement-breakpoint
ALTER TABLE "client" DROP CONSTRAINT "client_colour";--> statement-breakpoint
-- Grey and teal are gone: their Clients take yellow and orange, the colours
-- that replaced them in lib/client-colour's name hash.
UPDATE "client" SET "colour" = CASE "colour" WHEN 'slate' THEN 'yellow' ELSE 'orange' END WHERE "colour" IN ('slate', 'sky');--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_colour" CHECK ("colour" in ('rose', 'orange', 'yellow', 'green', 'blue', 'violet'));
