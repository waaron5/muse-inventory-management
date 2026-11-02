import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { openSearch } from "./search";
import { signInAsNewPerson } from "./sign-in";

/** A past Event with nothing on it, straight into the database. */
async function pastEvent() {
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = { client: randomUUID(), event: randomUUID() };
  const tag = ids.event.slice(0, 8);
  try {
    await client.query(`insert into client (id, name) values ($1, $2)`, [ids.client, `Acme ${ids.client}`]);
    await client.query(
      `insert into event (id, name, client_id, starts_on, ends_on) values ($1, $2, $3, '2026-01-10', '2026-01-10')`,
      [ids.event, `Gala ${tag}`, ids.client],
    );
  } finally {
    await client.end();
  }
  return { ids, names: { booth: `Photo booth ${tag}` } };
}

test("a Borrowed Item is a plain Line with its lender, never enters the catalog, and an Event that ended can't be cancelled", async ({
  page,
}) => {
  const { ids, names } = await pastEvent();
  await signInAsNewPerson(page, "Borrow Tester");
  await page.goto(`/events/${ids.event}`);
  const main = page.getByRole("main");

  await page.getByRole("button", { name: "Add non-inventory", exact: true }).click();
  const borrow = page.getByRole("dialog", { name: "Add non-inventory", exact: true });
  await borrow.getByLabel("Name").fill(names.booth);
  await borrow.getByLabel("How many").fill("2");
  await borrow.getByLabel("Borrowed from").fill("Lens & Co");
  await borrow.getByRole("button", { name: "Add" }).click();
  await expect(main.getByText("Borrowed from Lens & Co")).toBeVisible();
  await expect(main.getByRole("button", { name: "2 borrowed. Change how many" })).toBeVisible();

  // It happened, so it isn't cancelled.
  await expect(page.getByRole("button", { name: "Cancel event", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Cancel event", exact: true })).toHaveAttribute("title", "Ended");
  await page.keyboard.press("Escape");

  await page.goto("/inventory");
  // It doesn't enter the catalog.
  const field = await openSearch(page);
  await field.fill(names.booth);
  await expect(page.getByText("Nothing matches.")).toBeVisible();
  await field.press("Escape");
});

test("adds a borrowed item using just a name and count before the Event has dates, while inventory waits for them", async ({ page }) => {
  const { ids, names } = await pastEvent();
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  try {
    await client.query("update event set starts_on=null, ends_on=null where id=$1", [ids.event]);
  } finally {
    await client.end();
  }
  await signInAsNewPerson(page, "Borrow Planner");
  await page.goto(`/events/${ids.event}`);
  await page.getByRole("button", { name: "Add inventory", exact: true }).click();
  const inventoryPicker = page.getByRole("dialog", { name: "Add inventory", exact: true });
  await expect(inventoryPicker.getByText("Add Event dates to reserve inventory.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(inventoryPicker).toBeHidden();

  await page.getByRole("button", { name: "Add non-inventory", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Add non-inventory", exact: true });
  await picker.getByLabel("Name", { exact: true }).fill(names.booth);
  await picker.getByLabel("How many").fill("2");
  await picker.getByRole("button", { name: "Add", exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByRole("button", { name: "2 borrowed. Change how many" })).toBeVisible();
  await page.goto(`/events/${ids.event}/print`);
  await expect(page.getByRole("heading", { name: "Borrowed Items", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Page 1 of 1", exact: true }).getByText(names.booth, { exact: true })).toBeVisible();
});
