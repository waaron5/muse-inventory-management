import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { signInAsNewPerson } from "./sign-in";

/** An Event and a priced Inventory Item, straight into the database: the catalog is an Admin's. */
async function plan() {
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = { client: randomUUID(), event: randomUUID(), item: randomUUID() };
  const itemName = `Folding chair ${ids.item.slice(0, 8)}`;
  try {
    await client.query(`insert into client (id, name) values ($1, $2)`, [ids.client, `Acme ${ids.client}`]);
    await client.query(
      `insert into event (id, name, client_id, starts_on, ends_on) values ($1, 'Summit', $2, '2027-05-10', '2027-05-12')`,
      [ids.event, ids.client],
    );
    await client.query(`insert into item (id, kind, name, unit_price_cents) values ($1, 'inventory', $2, 1250)`, [
      ids.item,
      itemName,
    ]);
  } finally {
    await client.end();
  }
  return { eventId: ids.event, itemName };
}

test("reserves an Inventory Item from the Event's picker, then changes and removes the Line", async ({ page }) => {
  const { eventId, itemName } = await plan();
  await signInAsNewPerson(page, "Reservations Tester");
  await page.goto(`/events/${eventId}`);
  const inventory = page.locator("section").filter({ has: page.getByRole("heading", { name: "Inventory" }) });

  await inventory.getByRole("button", { name: "Add inventory", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Add inventory", exact: true });
  await expect(picker.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
  await picker.getByRole("searchbox", { name: "Search" }).fill(itemName);
  await picker.getByRole("button", { name: new RegExp(itemName) }).click();

  // The sheet header goes back to the same search; closing starts a fresh picker.
  const back = picker.getByRole("button", { name: "Back", exact: true });
  await expect(back.locator("..").getByRole("button", { name: "Close", exact: true })).toBeVisible();
  await back.click();
  await expect(picker.getByRole("searchbox", { name: "Search" })).toHaveValue(itemName);
  await expect(back).toHaveCount(0);
  await picker.getByRole("button", { name: new RegExp(itemName) }).click();
  await picker.getByRole("button", { name: "Close", exact: true }).click();
  await expect(picker).toBeHidden();
  await inventory.getByRole("button", { name: "Add inventory", exact: true }).click();
  await expect(picker.getByRole("searchbox", { name: "Search" })).toHaveValue("");
  await expect(back).toHaveCount(0);
  await picker.getByRole("searchbox", { name: "Search" }).fill(itemName);
  await picker.getByRole("button", { name: new RegExp(itemName) }).click();
  await picker.getByLabel("How many").fill("3");
  // None are in storage: asking anyway warns, then saves.
  await expect(picker.getByRole("status")).toContainText("It still saves");
  await picker.getByRole("button", { name: "Add", exact: true }).click();

  await expect(picker).toBeHidden();
  await expect(inventory.getByRole("link", { name: itemName })).toBeVisible();
  await expect(page.getByText("Gear and gifts reserved: $37.50")).toBeVisible();

  await inventory.getByRole("button", { name: "3 reserved. Change how many" }).click();
  await inventory.getByLabel(`How many ${itemName}`).fill("5");
  await inventory.getByRole("button", { name: "Save" }).click();
  await expect(inventory.getByRole("button", { name: "5 reserved. Change how many" })).toBeVisible();

  await inventory.getByRole("button", { name: "5 reserved. Change how many" }).click();
  await inventory.getByRole("button", { name: "Remove" }).click();
  await expect(inventory.getByRole("listitem")).toHaveCount(0);
});
