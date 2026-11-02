import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { signInAsNewPerson } from "./sign-in";

/** One Event for one Client, straight into the database. */
async function anEvent() {
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = { client: randomUUID(), event: randomUUID() };
  const name = `Summit ${ids.event.slice(0, 8)}`;
  try {
    await client.query(`insert into client (id, name) values ($1, $2)`, [ids.client, `Acme ${ids.client}`]);
    await client.query(
      `insert into event (id, name, client_id, starts_on, ends_on) values ($1, $2, $3, '2030-06-10', '2030-06-12')`,
      [ids.event, name, ids.client],
    );
  } finally {
    await client.end();
  }
  return { ids, name };
}

test("saving an Event's edit goes back where it was opened from, with a snackbar", async ({ page }) => {
  const { ids, name } = await anEvent();
  await signInAsNewPerson(page, "Snackbar Tester");
  const snackbar = page.getByText("Changes saved");

  // Opened from the filtered list, it goes back to that list.
  const list = `/events?client=${ids.client}`;
  await page.goto(`/events/${ids.event}/edit?back=${encodeURIComponent(list)}`);
  await page.getByLabel("Venue").fill("Grand Hall");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(new RegExp(`/events\\?client=${ids.client}$`));
  await expect(snackbar).toBeVisible();
  await expect(page.getByText(name).filter({ visible: true })).toBeVisible();
  // A centred Save can leave the pointer over the snackbar area, pausing its timer.
  await page.mouse.move(0, 0);
  // Shown once: it's gone after a few seconds and doesn't come back on reload.
  await expect(snackbar).toBeHidden({ timeout: 6000 });
  await page.reload();
  await expect(page.getByText(name).filter({ visible: true })).toBeVisible();
  await expect(snackbar).toHaveCount(0);

  // Opened from the Event, it goes back to the Event.
  await page.goto(`/events/${ids.event}/edit`);
  await page.getByLabel("Venue").fill("Small Hall");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(new RegExp(`/events/${ids.event}$`));
  await expect(snackbar).toBeVisible();

  // A link elsewhere is ignored.
  await page.goto(`/events/${ids.event}/edit?back=${encodeURIComponent("//example.com")}`);
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", `/events/${ids.event}`);
});

test("a refused save shows its error, never a snackbar", async ({ page }) => {
  const { ids } = await anEvent();
  await signInAsNewPerson(page, "Refusal Tester");

  await page.goto(`/events/${ids.event}/edit`);
  await page.getByLabel("Start date").fill("2030-06-12");
  await page.getByLabel("End date").fill("2030-06-10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveText("The Event can't end before it starts.");
  await expect(page).toHaveURL(new RegExp(`/events/${ids.event}/edit$`));
  await expect(page.getByText("Changes saved")).toHaveCount(0);
});
