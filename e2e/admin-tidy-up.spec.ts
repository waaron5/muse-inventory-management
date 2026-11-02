import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { settingsRow } from "./settings-rows";
import { signInAsNewPerson } from "./sign-in";

/**
 * Two Clients that are one, each with an Event; an Event to reserve for; an
 * item with Stock and one without, at their own Locations; and a Location
 * holding nothing. Straight into the database.
 */
async function untidy() {
  const db = new Client({ connectionString: e2eDatabaseURL });
  await db.connect();
  const tag = randomUUID().slice(0, 8);
  const ids = {
    client: randomUUID(),
    duplicate: randomUUID(),
    event: randomUUID(),
    stocked: randomUUID(),
    empty: randomUUID(),
    warehouse: randomUUID(),
    shed: randomUUID(),
  };
  const names = {
    client: `Ivorypeak ${tag}`,
    duplicate: `Ivorypeak Inc ${tag}`,
    stocked: `Chalkboard ${tag}`,
    empty: `Old easel ${tag}`,
    warehouse: `Warehouse ${tag}`,
    shed: `Shed ${tag}`,
  };
  try {
    await db.query(`insert into client (id, name) values ($1, $2), ($3, $4)`, [
      ids.client,
      names.client,
      ids.duplicate,
      names.duplicate,
    ]);
    await db.query(
      `insert into event (id, name, client_id, starts_on, ends_on) values ($1, 'Roadshow', $2, '2030-06-10', '2030-06-12'), ($3, 'Summit', $4, null, null)`,
      [ids.event, ids.client, randomUUID(), ids.duplicate],
    );
    await db.query(`insert into item (id, kind, name) values ($1, 'inventory', $2), ($3, 'inventory', $4)`, [
      ids.stocked,
      names.stocked,
      ids.empty,
      names.empty,
    ]);
    await db.query(`insert into location (id, name) values ($1, $2), ($3, $4)`, [
      ids.warehouse,
      names.warehouse,
      ids.shed,
      names.shed,
    ]);
    await db.query(`insert into stock (item_id, location_id, count) values ($1, $2, 2)`, [ids.stocked, ids.warehouse]);
  } finally {
    await db.end();
  }
  return { ids, names };
}

test("an Admin merges a duplicate Client, leaving one Client with all the Events", async ({ page }) => {
  const { names } = await untidy();
  await signInAsNewPerson(page, "Tidy Admin", "admin");
  await page.getByRole("button", { name: "Account: Tidy Admin" }).filter({ visible: true }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await (await settingsRow(page, "Clients", names.duplicate)).getByRole("button", { name: `More for ${names.duplicate}` }).click();
  await page.getByRole("menuitem", { name: "Merge into…" }).click();
  const merging = page.getByRole("dialog", { name: `Merge ${names.duplicate}` });
  await expect(merging).toContainText("Its 1 Event moves to the Client you pick");
  await merging.getByLabel("Merge into").selectOption({ label: names.client });
  await merging.getByRole("button", { name: "Merge" }).click();

  await expect(merging).toBeHidden();
  await expect(page.getByRole("listitem").filter({ hasText: names.duplicate })).toHaveCount(0);
  await expect(await settingsRow(page, "Clients", names.client)).toContainText("2 Events");
});

test("an Admin archives an item that has nothing left, and it drops out of the + Add picker", async ({ page }) => {
  const { ids, names } = await untidy();
  await signInAsNewPerson(page, "Archive Admin", "admin");

  // One with Stock can't be Archived yet.
  await page.goto(`/inventory/${ids.stocked}`);
  await expect(page.getByRole("button", { name: "Archive", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Archive", exact: true })).toHaveAttribute("title", "2 in storage");
  await page.keyboard.press("Escape");

  await page.goto(`/inventory/${ids.empty}`);
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  const archiving = page.getByRole("dialog", { name: `Archive ${names.empty}?` });
  await archiving.getByRole("button", { name: "Archive" }).click();
  await expect(archiving).toBeHidden();
  // The badge, not the snackbar that says so too.
  await expect(page.getByRole("main").getByText("Archived", { exact: true })).toBeVisible();

  await page.goto(`/events/${ids.event}`);
  const inventory = page.locator("section").filter({ has: page.getByRole("heading", { name: "Inventory" }) });
  await inventory.getByRole("button", { name: "Add inventory", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Add inventory", exact: true });
  await picker.getByRole("searchbox", { name: "Search" }).fill(names.empty);
  await expect(picker.getByText("Nothing matches.")).toBeVisible();
  await picker.getByRole("searchbox", { name: "Search" }).fill(names.stocked);
  await expect(picker.getByRole("button", { name: new RegExp(names.stocked) })).toBeVisible();
});

test("an Admin renames and deletes Locations without archiving", async ({ page }) => {
  const { names } = await untidy();
  await signInAsNewPerson(page, "Places Admin", "admin");
  await page.goto("/locations");

  const warehouse = await settingsRow(page, "Locations", names.warehouse);
  await expect(warehouse).toContainText("Holds 2");
  await warehouse.getByRole("button", { name: `More for ${names.warehouse}` }).click();
  await expect(page.getByRole("menuitem", { name: /Archive/ })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const renaming = page.getByRole("dialog", { name: `Rename ${names.warehouse}` });
  await renaming.getByLabel("Name").fill(`Main ${names.warehouse}`);
  await renaming.getByRole("button", { name: "Save" }).click();
  await expect(renaming).toBeHidden();
  await settingsRow(page, "Locations", `Main ${names.warehouse}`);

  const shed = await settingsRow(page, "Locations", names.shed);
  await shed.getByRole("button", { name: `More for ${names.shed}` }).click();
  await page.getByRole("menuitem", { name: "Delete Location" }).click();
  await page.getByRole("dialog", { name: `Delete ${names.shed}?` }).getByRole("button", { name: "Delete Location" }).click();
  await expect(shed).toHaveCount(0);
});

test("a User sees the Clients and Locations, but none of their tidy-up", async ({ page }) => {
  const { names } = await untidy();
  await signInAsNewPerson(page, "Tidy User");
  await page.getByRole("button", { name: "Account: Tidy User" }).filter({ visible: true }).click();
  await expect(page.getByRole("menuitem", { name: "Clients" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Locations" })).toHaveCount(0);

  // Both are cards on the one Settings page. A Client's colour is everyone's to change.
  await page.goto("/clients");
  const clients = page.getByRole("region", { name: "Clients", exact: true });
  await settingsRow(page, "Clients", names.client);
  await clients.getByRole("button", { name: `More for ${names.client}` }).click();
  await expect(page.getByRole("menuitem")).toHaveText(["Change colour"]);
  await page.keyboard.press("Escape");
  await page.goto("/locations");
  const locations = page.getByRole("region", { name: "Locations", exact: true });
  await settingsRow(page, "Locations", names.shed);
  await expect(locations.getByRole("button", { name: /^More for / })).toHaveCount(0);
});
