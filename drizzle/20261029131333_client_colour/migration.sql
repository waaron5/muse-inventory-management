ALTER TABLE "client" ADD COLUMN "colour" text DEFAULT 'slate' NOT NULL;--> statement-breakpoint
-- Freeze existing identities using lib/client-colour's original name hash.
-- JavaScript iterates code points but charCodeAt(0) hashes their first UTF-16 unit.
WITH RECURSIVE names AS (
  SELECT id, lower(regexp_replace(trim(name), '\s+', ' ', 'g')) AS name FROM client
), hashes AS (
  SELECT id, name, 1 AS position, 0::bigint AS hash FROM names
  UNION ALL
  SELECT id, name, position + 1,
    (hash * 31 + CASE WHEN ascii(substr(name, position, 1)) > 65535
      THEN 55296 + (ascii(substr(name, position, 1)) - 65536) / 1024
      ELSE ascii(substr(name, position, 1)) END) % 4294967296
  FROM hashes WHERE position <= length(name)
)
UPDATE client SET colour = CASE
  WHEN hashes.name = 'ivorypeak' THEN 'rose'
  WHEN hashes.name IN ('birchline', 'birch line') THEN 'violet'
  ELSE (ARRAY['slate', 'sky', 'green', 'violet', 'blue'])[(hashes.hash % 5)::int + 1]
END
FROM hashes WHERE client.id = hashes.id AND hashes.position = length(hashes.name) + 1;
--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_colour" CHECK ("colour" in ('slate', 'sky', 'green', 'violet', 'blue', 'rose'));
