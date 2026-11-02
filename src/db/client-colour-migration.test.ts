import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import { clientColour } from "@/lib/client-colour";

it("preserves existing Client colours when adding the saved setting, moving grey and teal to yellow and orange", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table client (id serial primary key, name text not null)");
    const names = ["Ivorypeak", "Birchline", "Birch Line", "Acme", "Horizon Tech", "A long name that overflows a 32-bit hash", "Café", "🚀 Launch"];
    for (const name of names) await db.query("insert into client (name) values ($1)", [name]);
    await db.exec(readFileSync("drizzle/20261029131333_client_colour/migration.sql", "utf8"));
    await db.exec(readFileSync("drizzle/20261031144423_client_colour_yellow_orange/migration.sql", "utf8"));
    const { rows } = await db.query<{ name: string; colour: string }>("select name, colour from client order by id");
    expect(rows).toEqual(names.map((name) => ({ name, colour: clientColour(name) })));
  } finally {
    await db.close();
  }
});
