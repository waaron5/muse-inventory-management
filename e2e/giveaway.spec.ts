import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eCronSecret, e2eDatabaseURL } from "../playwright.config";
import { signInAsNewPerson } from "./sign-in";

/** An Event that ended in January, reserving 5 of the 7 caps in the Warehouse, straight into the database. */
async function endedEvent() {
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = { client: randomUUID(), event: randomUUID(), caps: randomUUID(), warehouse: randomUUID() };
  const tag = ids.event.slice(0, 8);
  const names = { event: `Expo ${tag}`, caps: `Cap ${tag}`, warehouse: `Warehouse ${tag}` };
  try {
    await client.query(`insert into client (id, name) values ($1, $2)`, [ids.client, `Acme ${ids.client}`]);
    await client.query(
      `insert into event (id, name, client_id, starts_on, ends_on) values ($1, $2, $3, '2026-01-10', '2026-01-12')`,
      [ids.event, names.event, ids.client],
    );
    await client.query(`insert into item (id, kind, name) values ($1, 'gift', $2)`, [ids.caps, names.caps]);
    await client.query(`insert into location (id, name) values ($1, $2)`, [ids.warehouse, names.warehouse]);
    await client.query(`insert into stock (item_id, location_id, count) values ($1, $2, 7)`, [ids.caps, ids.warehouse]);
    await client.query(`insert into line (event_id, item_id, reserved) values ($1, $2, 5)`, [ids.event, ids.caps]);
  } finally {
    await client.end();
  }
  return { ids, names };
}

test("the daily giveaway gives an ended Event's Gifts away, and leftovers go back by changing the count", async ({
  page,
  request,
}) => {
  const { ids, names } = await endedEvent();

  // Only Vercel Cron, with the secret, runs it.
  expect((await request.get("/api/give-away")).status()).toBe(404);
  expect((await request.get("/api/give-away", { headers: { authorization: `Bearer ${e2eCronSecret}` } })).ok()).toBe(true);

  await signInAsNewPerson(page, "Leftovers Tester");
  await page.goto(`/events/${ids.event}`);
  const main = page.getByRole("main");
  await expect(main.getByText("Given away", { exact: true })).toBeVisible();

  // Two came back unopened.
  await main.getByRole("button", { name: "5 given away. Change how many" }).click();
  await main.getByLabel(`How many ${names.caps}`).fill("3");
  await main.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Count changed")).toBeVisible();
  await expect(main.getByRole("button", { name: "3 given away. Change how many" })).toBeVisible();

  await page.goto(`/gifts/${ids.caps}`);
  await expect(main.getByRole("heading", { name: "Count 4" })).toBeVisible();
  // Given away by nobody on its last day, then put back by whoever changed the count.
  await expect(main.getByText(`from ${names.warehouse} for ${names.event}`)).toBeVisible();
  await expect(main.getByText(/^Automatic · Jan 12, 2026/)).toBeVisible();
  await expect(main.getByText(`to ${names.warehouse} for ${names.event}`)).toBeVisible();
  await expect(main.getByText("Leftovers back")).toBeVisible();
});
