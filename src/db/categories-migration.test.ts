import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const migration = "20261028171850_inventory_categories";
const approved = [
  ["3751ab86-54ef-424e-8904-363ae6136d40", "6 x 8 glass vases", "Vases & Vessels"],
  ["a9566d80-7b47-411b-aec5-aec1b162a18f", "Bud Vases", "Vases & Vessels"],
  ["a2a244dc-8ac1-4683-991a-226846a9391c", "Glass Pillar Vases - Assort heights", "Vases & Vessels"],
  ["d27f0575-edf9-4e10-95c7-07683e82fa1d", "Cream Stools", "Furniture"],
  ["b46c1b26-343c-4e74-a72f-a3f0d459496b", "Umbrella Stand:Side Table", "Furniture"],
  ["ad376176-b8a1-47a8-b99f-7f9e9e6ef13d", "Cream umbrellas w:fringe", "Umbrellas & Shade"],
  ["28dbc9aa-7f49-4189-8258-abca091e30a7", "LED Lamps w:wicker shade", "Lighting & Candle Holders"],
  ["91963c10-41f9-4060-8f65-353948463efc", "Disco Votives", "Lighting & Candle Holders"],
  ["c457c1c3-afaa-4c56-94a2-1f7cc5b75e59", "Disco Pillow Covers", "Decor & Tabletop"],
  ["fab18018-0fde-4e0d-bb52-ceea5b780f12", "Wood Discs", "Decor & Tabletop"],
  ["13ecd02e-ca06-4d1a-a02b-2a28aaa9f6ba", "Woven Placements", "Decor & Tabletop"],
];

it("migrates the existing catalog into the approved categories without changing Stock or History", async () => {
  const db = new PGlite();
  try {
    const folders = (await readdir("drizzle")).filter((folder) => /^\d/.test(folder)).sort();
    for (const folder of folders.filter((folder) => folder < migration)) {
      await db.exec(await readFile(`drizzle/${folder}/migration.sql`, "utf8"));
    }
    const place = crypto.randomUUID();
    await db.query("insert into location (id, name) values ($1, 'Warehouse')", [place]);
    for (const [id, name] of approved) {
      await db.query("insert into item (id, kind, name) values ($1, 'inventory', $2)", [id, name]);
      await db.query("insert into stock (item_id, location_id, count) values ($1, $2, 4)", [id, place]);
      await db.query("insert into history_entry (item_id, kind, count, to_location_id, by_user_id, happened_on) values ($1, 'starting-stock', 4, $2, 'test-admin', '2026-10-28')", [id, place]);
    }
    const unrelated = crypto.randomUUID();
    const gift = crypto.randomUUID();
    await db.query("insert into item (id, kind, name) values ($1, 'inventory', 'Bud Vases'), ($2, 'gift', 'Gift')", [unrelated, gift]);
    const stockBefore = await db.query("select * from stock order by item_id");
    const historyBefore = await db.query("select * from history_entry order by item_id");
    await db.exec(await readFile(`drizzle/${migration}/migration.sql`, "utf8"));
    const result = await db.query<{ id: string; name: string; category: string | null }>("select i.id, i.name, c.name as category from item i left join category c on c.id = i.category_id");
    for (const [id, name, category] of approved) expect(result.rows.find((row) => row.id === id)).toEqual({ id, name, category });
    for (const id of [unrelated, gift]) expect(result.rows.find((row) => row.id === id)?.category).toBeNull();
    expect((await db.query("select * from stock order by item_id")).rows).toEqual(stockBefore.rows);
    expect((await db.query("select * from history_entry order by item_id")).rows).toEqual(historyBefore.rows);
  } finally {
    await db.close();
  }
});
