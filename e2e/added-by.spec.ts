import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { signInAsNewPerson } from "./sign-in";

/** An Event with one Line Bea added and one from before who added it was kept, straight into the database. */
async function plan() {
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = { client: randomUUID(), event: randomUUID(), bea: randomUUID() };
  const tag = ids.event.slice(0, 8);
  const names = { event: `Gala ${tag}`, bea: `Bea ${tag}`, booth: `Photo booth ${tag}`, lights: `String lights ${tag}` };
  try {
    await client.query(`insert into "user" (id, name, email) values ($1, $2, $3)`, [ids.bea, names.bea, `${ids.bea}@example.com`]);
    await client.query(`insert into client (id, name) values ($1, $2)`, [ids.client, `Acme ${ids.client}`]);
    await client.query(
      `insert into event (id, name, client_id, starts_on, ends_on) values ($1, $2, $3, '2031-05-10', '2031-05-12')`,
      [ids.event, names.event, ids.client],
    );
    await client.query(
      `insert into line (event_id, kind, name, lender, reserved, added_by_user_id) values ($1, 'borrowed', $2, '', 2, $3), ($1, 'borrowed', $4, '', 1, null)`,
      [ids.event, names.booth, ids.bea, names.lights],
    );
  } finally {
    await client.end();
  }
  return { ids, names };
}

test("a Line shows who added it beside its count, on the Event's page and in its row", async ({ page, isMobile }) => {
  const { ids, names } = await plan();
  await signInAsNewPerson(page, "Bubble Tester");
  await page.goto(`/events/${ids.event}`);
  const main = page.getByRole("main");

  const booth = main.getByRole("listitem").filter({ hasText: names.booth });
  const bubble = booth.getByRole("button", { name: new RegExp(`^Added by ${names.bea} · [A-Z][a-z]{2} \\d{1,2}$`) });
  await expect(bubble).toBeVisible();
  // To the left of the count.
  const count = booth.getByRole("button", { name: /Change how many/ });
  expect((await bubble.boundingBox())!.x).toBeLessThan((await count.boundingBox())!.x);
  await bubble.click();
  await expect(page.getByRole("tooltip", { name: new RegExp(`^Added by ${names.bea}`) })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("added-by.png") });
  // Nobody is known for a Line from before.
  await expect(main.getByRole("listitem").filter({ hasText: names.lights }).getByRole("button", { name: /^Added by/ })).toHaveCount(0);

  if (isMobile) return;
  await page.goto(`/events?client=${ids.client}`);
  await main.getByRole("row", { name: new RegExp(`^${names.event}`) }).getByRole("button", { name: /^Inventory:/ }).click();
  const panel = main.getByRole("region", { name: `Lines of ${names.event}` });
  await expect(panel.getByRole("button", { name: new RegExp(`^Added by ${names.bea}`) })).toBeVisible();
});
