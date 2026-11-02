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

test("flags every competing Event, and an Admin's acknowledgement clears them all", async ({ page }) => {
  const { ids, names } = await clash();
  await signInAsNewPerson(page, "Shortage Tester");

  // Both Events, by their Client.
  await page.goto(`/events?client=${ids.client}`);
  await expect(page.getByText("Short by 1", { exact: true }).filter({ visible: true })).toHaveCount(2);

  await page.goto(`/events/${ids.first}`);
  const warning = page.getByRole("list", { name: "Warnings" });
  await warning.getByRole("button", { name: `Short by 1 · ${names.item}` }).click();
  const sheet = page.getByRole("dialog", { name: `Short by 1 · ${names.item}` });
  await expect(sheet.getByRole("link", { name: new RegExp(names.second) })).toBeVisible();
  // A User sees why, but can't acknowledge.
  await expect(sheet.getByRole("button", { name: "Acknowledge" })).toBeDisabled();
  await expect(sheet.getByText("Ask an Admin")).toBeVisible();

  await page.context().clearCookies();
  await signInAsNewPerson(page, "Shortage Admin", "admin");
  await page.goto(`/events/${ids.first}`);
  await warning.getByRole("button", { name: `Short by 1 · ${names.item}` }).click();
  await sheet.getByLabel("How it will be covered").fill("Borrowing one from the Hilton");
  await sheet.getByRole("button", { name: "Acknowledge" }).click();

  await expect(sheet).toBeHidden();
  await expect(warning).toBeHidden();
  await page.goto(`/events/${ids.second}`);
  await expect(page.getByRole("list", { name: "Warnings" })).toBeHidden();
  await page.getByRole("button", { name: "Short by 1, acknowledged" }).click();
  await expect(page.getByText("Borrowing one from the Hilton")).toBeVisible();
  await expect(page.getByText(/Acknowledged by Shortage Admin/)).toBeVisible();
});
