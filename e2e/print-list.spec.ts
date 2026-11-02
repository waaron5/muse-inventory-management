import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { signInAsNewPerson } from "./sign-in";

/**
 * An Event wanting 8 chairs, split 6 and 4 across two Locations, 3 jackets,
 * and a Borrowed photo booth, straight into the database.
 */
async function reservedEvent() {
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = {
    client: randomUUID(),
    event: randomUUID(),
    chairs: randomUUID(),
    jackets: randomUUID(),
    warehouse: randomUUID(),
    garage: randomUUID(),
  };
  const tag = ids.event.slice(0, 8);
  const names = {
    event: `Gala ${tag}`,
    chairs: `Chair ${tag}`,
    jackets: `Jacket ${tag}`,
    booth: `Photo booth ${tag}`,
    lender: `Pinnacle ${tag}`,
    warehouse: `Warehouse ${tag}`,
    garage: `Garage ${tag}`,
  };
  try {
    await client.query(`insert into client (id, name) values ($1, $2)`, [ids.client, `Acme ${ids.client}`]);
    await client.query(
      `insert into event (id, name, client_id, starts_on, ends_on) values ($1, $2, $3, '2030-06-10', '2030-06-10')`,
      [ids.event, names.event, ids.client],
    );
    await client.query(`insert into item (id, kind, name) values ($1, 'inventory', $2), ($3, 'gift', $4)`, [
      ids.chairs,
      names.chairs,
      ids.jackets,
      names.jackets,
    ]);
    await client.query(`insert into location (id, name) values ($1, $2), ($3, $4)`, [
      ids.warehouse,
      names.warehouse,
      ids.garage,
      names.garage,
    ]);
    await client.query(
      `insert into stock (item_id, location_id, count) values ($1, $4, 10), ($2, $3, 5)`,
      [ids.chairs, ids.jackets, ids.warehouse, ids.garage],
    );
    await client.query(`insert into line (event_id, item_id, reserved) values ($1, $2, 8), ($1, $3, 3)`, [
      ids.event,
      ids.chairs,
      ids.jackets,
    ]);
    await client.query(
      `insert into line (event_id, kind, name, lender, reserved) values ($1, 'borrowed', $2, $3, 1)`,
      [ids.event, names.booth, names.lender],
    );
  } finally {
    await client.end();
  }
  return { ids, names };
}

test("prints everything the Event needs on one Letter page with no app chrome", async ({ page }) => {
  const { ids, names } = await reservedEvent();
  await signInAsNewPerson(page, "Print Tester");

  await page.goto(`/events/${ids.event}`);
  await page.getByRole("link", { name: "Print / PDF" }).click();
  await expect(page.getByRole("heading", { name: "Print list" })).toBeVisible();

  const sheet = page.getByRole("region", { name: "Page 1 of 1" });
  await expect(sheet.getByRole("heading", { name: names.event })).toBeVisible();
  await expect(sheet.getByRole("img", { name: "QR code to this Event" })).toBeVisible();
  // Each Location with its items, then the Borrowed Item under its lender.
  await expect(sheet.getByRole("heading", { level: 3 })).toHaveText([
    names.garage,
    names.warehouse,
    names.lender,
  ]);
  await expect(sheet.getByText(names.booth)).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("heading", { name: "Print list" })).toBeHidden();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Muse, go to Events" })).toHaveCount(0);
  // The sheet is the page: Letter, at full size, at the top left.
  expect(await sheet.boundingBox()).toEqual({ x: 0, y: 0, width: 8.5 * 96, height: 11 * 96 });
  await page.emulateMedia({ media: "screen" });
});
