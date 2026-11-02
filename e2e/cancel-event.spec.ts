import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { signInAsNewPerson } from "./sign-in";

/** Two Events wanting 3 and 2 of 4 tents on the same day, straight into the database. */
async function clash() {
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = { client: randomUUID(), first: randomUUID(), second: randomUUID(), item: randomUUID(), at: randomUUID() };
  const tag = ids.item.slice(0, 8);
  const names = { first: `Gala ${tag}`, second: `Party ${tag}`, item: `Tent ${tag}` };
  try {
    await client.query(`insert into client (id, name) values ($1, $2)`, [ids.client, `Acme ${ids.client}`]);
    for (const [id, name] of [
      [ids.first, names.first],
      [ids.second, names.second],
    ]) {
      await client.query(
        `insert into event (id, name, client_id, starts_on, ends_on) values ($1, $2, $3, '2030-06-10', '2030-06-10')`,
        [id, name, ids.client],
      );
    }
    await client.query(`insert into item (id, kind, name) values ($1, 'inventory', $2)`, [ids.item, names.item]);
    await client.query(`insert into location (id, name) values ($1, $2)`, [ids.at, `Warehouse ${tag}`]);
    await client.query(`insert into stock (item_id, location_id, count) values ($1, $2, 4)`, [ids.item, ids.at]);
    await client.query(`insert into line (event_id, item_id, reserved) values ($1, $3, 3), ($2, $3, 2)`, [
      ids.first,
      ids.second,
      ids.item,
    ]);
  } finally {
    await client.end();
  }
  return { ids, names };
}

test("a User cancels an Event, releasing its Reservations, and reinstates it, bringing them back", async ({ page }) => {
  const { ids, names } = await clash();
  await signInAsNewPerson(page, "Cancel Tester");
  const warnings = page.getByRole("list", { name: "Warnings" });

  await page.goto(`/events/${ids.first}`);
  await expect(warnings).toBeVisible();
  // In no History, but deleting is an Admin's.
  await expect(page.getByRole("button", { name: "Delete event", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete event", exact: true })).toHaveAttribute("title", "Ask an Admin");
  await page.getByRole("button", { name: "Cancel event", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Cancel this Event?" });
  await sheet.getByRole("button", { name: "Cancel event" }).click();

  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: "Reinstate event" })).toBeVisible();
  await expect(warnings).toBeHidden();
  await page.goto(`/events?tab=cancelled&client=${ids.client}`);
  await expect(page.getByText(names.first).filter({ visible: true })).toBeVisible();
  await page.goto(`/events/${ids.second}`);
  await expect(warnings).toBeHidden();

  await page.goto(`/events/${ids.first}`);
  await page.getByRole("button", { name: "Reinstate event", exact: true }).click();
  await page.getByRole("dialog", { name: "Reinstate this Event?" }).getByRole("button", { name: "Reinstate event", exact: true }).click();

  await expect(page.getByRole("button", { name: "Reinstate event" })).toBeHidden();
  await expect(warnings.getByRole("button", { name: `Short by 1 · ${names.item}` })).toBeVisible();
});

test("an Admin deletes an Event in no History", async ({ page }) => {
  const { ids, names } = await clash();
  await signInAsNewPerson(page, "Delete Admin", "admin");

  await page.goto(`/events/${ids.first}`);
  await page.getByRole("button", { name: "Delete event", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Delete this Event?" });
  await expect(sheet.getByText(`${names.first} and its Lines are gone for good.`, { exact: false })).toBeVisible();
  await sheet.getByRole("button", { name: "Delete event" }).click();

  await expect(page).toHaveURL(/\/events$/);
  await page.goto(`/events/${ids.second}`);
  await expect(page.getByRole("list", { name: "Warnings" })).toBeHidden();
});
