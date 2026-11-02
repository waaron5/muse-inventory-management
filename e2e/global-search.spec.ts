import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { isPhone, openSearch, pressShortcut } from "./search";
import { signInAsNewPerson } from "./sign-in";

/** An Event with a P&L Code, an item with a SKU and an Archived one sharing it. Straight into the database. */
async function findable() {
  const db = new Client({ connectionString: e2eDatabaseURL });
  await db.connect();
  const tag = randomUUID().slice(0, 8);
  const ids = { client: randomUUID(), event: randomUUID(), item: randomUUID(), archived: randomUUID() };
  const names = { event: `Roadshow ${tag}`, plCode: `IVP-Road ${tag}`, item: `Chalkboard ${tag}`, sku: `CB-${tag}`, archived: `Old chalkboard ${tag}` };
  try {
    await db.query(`insert into client (id, name) values ($1, $2)`, [ids.client, `Ivorypeak ${tag}`]);
    await db.query(`insert into event (id, name, client_id, pl_code, starts_on) values ($1, $2, $3, $4, '2030-06-10')`, [
      ids.event,
      names.event,
      ids.client,
      names.plCode,
    ]);
    await db.query(
      `insert into item (id, kind, name, sku, archived_at) values ($1, 'inventory', $2, $3, null), ($4, 'inventory', $5, $6, now())`,
      [ids.item, names.item, names.sku, ids.archived, names.archived, `${names.sku}-OLD`],
    );
  } finally {
    await db.end();
  }
  return { ids, names };
}

test("finds an Event by its P&L Code and an item by its SKU, leaving Archived items out", async ({ page }) => {
  const { ids, names } = await findable();
  await signInAsNewPerson(page, "Search Tester");
  await page.goto("/events");

  let field = await openSearch(page);
  await field.fill(names.plCode);
  await expect(page.getByRole("option", { name: names.event })).toBeVisible();
  await field.press("Enter");
  await expect(page).toHaveURL(`/events/${ids.event}`);
  await expect(page.getByRole("heading", { level: 1, name: names.event })).toBeVisible();

  await page.goto("/inventory");
  field = await openSearch(page);
  await field.fill(names.sku);
  const results = page.getByRole("listbox", { name: "Results" });
  await expect(results.getByRole("option", { name: names.item })).toBeVisible();
  await expect(results.getByRole("option")).toHaveCount(1);
  await results.getByRole("option", { name: names.item }).click();
  await expect(page).toHaveURL(`/inventory/${ids.item}`);
});

test("⌘K focuses search on desktop", async ({ page }) => {
  test.skip(isPhone(page), "Desktop only");
  await signInAsNewPerson(page, "Shortcut Tester");
  await page.goto("/gifts");

  await pressShortcut(page, "ControlOrMeta+k");
});
