import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const migration = "20261029011825_one_location_per_item";
const unassigned = "00000000-0000-4000-8000-000000000000";

async function before() {
  const db = new PGlite();
  const folders = (await readdir("drizzle")).filter((folder) => /^\d/.test(folder)).sort();
  for (const folder of folders.filter((folder) => folder < migration)) {
    await db.exec(await readFile(`drizzle/${folder}/migration.sql`, "utf8"));
  }
  return db;
}

const run = async (db: PGlite) => db.exec(await readFile(`drizzle/${migration}/migration.sql`, "utf8"));

it("leaves each item one balance: its stocked one, else one empty one, else none Unassigned", async () => {
  const db = await before();
  try {
    const [warehouse, garage] = [crypto.randomUUID(), crypto.randomUUID()];
    await db.query("insert into location (id, name) values ($1, 'Warehouse'), ($2, 'Garage')", [warehouse, garage]);
    const [stocked, empty, none] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    await db.query("insert into item (id, kind, name) values ($1, 'gift', 'Stocked'), ($2, 'gift', 'Empty'), ($3, 'gift', 'None')", [stocked, empty, none]);
    await db.query("insert into stock (item_id, location_id, count) values ($1, $3, 5), ($1, $4, 0), ($2, $3, 0), ($2, $4, 0)", [stocked, empty, warehouse, garage]);

    await run(db);

    const rows = (await db.query<{ item_id: string; location_id: string; count: number }>("select item_id, location_id, count from stock")).rows;
    expect(rows).toHaveLength(3);
    expect(rows).toContainEqual({ item_id: stocked, location_id: warehouse, count: 5 });
    expect(rows.find((r) => r.item_id === empty)?.count).toBe(0);
    expect(rows).toContainEqual({ item_id: none, location_id: unassigned, count: 0 });
    await expect(db.query("insert into stock (item_id, location_id, count) values ($1, $2, 1)", [stocked, garage])).rejects.toThrow();
  } finally {
    await db.close();
  }
});

it("stops, changing nothing, while an item's Stock is still split", async () => {
  const db = await before();
  try {
    const [warehouse, garage, item] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    await db.query("insert into location (id, name) values ($1, 'Warehouse'), ($2, 'Garage')", [warehouse, garage]);
    await db.query("insert into item (id, kind, name) values ($1, 'inventory', 'Split')", [item]);
    await db.query("insert into stock (item_id, location_id, count) values ($1, $2, 3), ($1, $3, 2)", [item, warehouse, garage]);

    await expect(db.exec(`begin; ${await readFile(`drizzle/${migration}/migration.sql`, "utf8")}; commit;`)).rejects.toThrow(/more than one Location/);
    await db.exec("rollback");
    expect((await db.query("select * from stock")).rows).toHaveLength(2);
  } finally {
    await db.close();
  }
});
