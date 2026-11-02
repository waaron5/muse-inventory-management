import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { settingsRow } from "./settings-rows";
import { signInAsNewPerson } from "./sign-in";

test("a Client's and a Location's names in Settings open Events and Inventory filtered to them", async ({ page }) => {
  const db = new Client({ connectionString: e2eDatabaseURL });
  const tag = randomUUID().slice(0, 8);
  const ids = { client: randomUUID(), event: randomUUID(), location: randomUUID(), item: randomUUID() };
  const names = { client: `Linked ${tag}`, event: `Offsite ${tag}`, location: `Shelf ${tag}`, item: `Lantern ${tag}` };
  await db.connect();
  try {
    await db.query("insert into client (id, name) values ($1, $2)", [ids.client, names.client]);
    await db.query("insert into event (id, name, client_id) values ($1, $2, $3)", [ids.event, names.event, ids.client]);
    await db.query("insert into location (id, name) values ($1, $2)", [ids.location, names.location]);
    await db.query("insert into item (id, kind, name) values ($1, 'inventory', $2)", [ids.item, names.item]);
    await db.query("insert into stock (item_id, location_id, count) values ($1, $2, 2)", [ids.item, ids.location]);
  } finally {
    await db.end();
  }

  await signInAsNewPerson(page, "Settings Link User");
  await page.goto("/settings#clients");
  await (await settingsRow(page, "Clients", names.client)).getByRole("link", { name: names.client, exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/events" && url.searchParams.get("client") === ids.client);
  await expect(page.getByRole("button", { name: `Client: ${names.client}`, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`^${names.event}(?:$| )`) }).filter({ visible: true })).toBeVisible();

  await page.goto("/settings#locations");
  await (await settingsRow(page, "Locations", names.location)).getByRole("link", { name: names.location, exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/inventory" && url.searchParams.get("location") === ids.location);
  await expect(page.getByRole("button", { name: `Location: ${names.location}`, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`^${names.item}(?:$| )`) }).filter({ visible: true })).toBeVisible();
});
