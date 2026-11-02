import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { isPhone } from "./search";
import { signInAsNewPerson } from "./sign-in";

/** One Event for its own Client, and an item with a photo and nothing in storage, straight into the database. */
async function aRow() {
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = { client: randomUUID(), event: randomUUID(), item: randomUUID(), photo: randomUUID() };
  const tag = ids.event.slice(0, 8);
  const names = { event: `Summit ${tag}`, item: `Banner ${tag}` };
  try {
    await client.query(`insert into client (id, name) values ($1, $2)`, [ids.client, `Acme ${tag}`]);
    await client.query(
      `insert into event (id, name, client_id, starts_on, ends_on) values ($1, $2, $3, '2030-06-10', '2030-06-12')`,
      [ids.event, names.event, ids.client],
    );
    await client.query(`insert into item (id, kind, name, photo) values ($1, 'inventory', $2, $3)`, [
      ids.item,
      names.item,
      ids.photo,
    ]);
  } finally {
    await client.end();
  }
  return { ids, names };
}

// The smoke has no photo store, so every photo is the same grey square.
async function anyPhoto(page: Page) {
  const square = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.route(/\/api\/photos\/[0-9a-f-]{36}/, (route) => route.fulfill({ contentType: "image/png", body: square }));
}

// Phone and desktop each render their own rows; only one set is on screen.
const more = (page: Page, name: string) =>
  page.getByRole("button", { name: `More for ${name}` }).filter({ visible: true });

test("an Event row's ⋯ edits and cancels it without opening the Event", async ({ page }) => {
  const { ids, names } = await aRow();
  await signInAsNewPerson(page, "Row Tester");
  const list = `/events?client=${ids.client}`;
  await page.goto(list);

  await more(page, names.event).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByLabel("Venue").fill("Grand Hall");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(new RegExp(`/events\\?client=${ids.client}$`));
  // Venue gives way to P&L on narrower tables, but is still shown on wide lists.
  // A phone row leaves it to the Event's page.
  if (!isPhone(page)) {
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect(page.getByRole("main").getByText("Grand Hall").filter({ visible: true })).toBeVisible();
  }

  await more(page, names.event).click();
  // Deleting is an Admin's, as on the Event's page.
  await expect(page.getByRole("menuitem", { name: /Delete event/ })).toContainText("Ask an Admin");
  await page.getByRole("menuitem", { name: "Cancel event" }).click();
  await page.getByRole("dialog", { name: "Cancel this Event?" }).getByRole("button", { name: "Cancel event" }).click();

  await expect(page.getByText("Event cancelled")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/events\\?client=${ids.client}$`));
  await expect(page.getByRole("main").getByText("Nothing matches these filters.")).toBeVisible();
});

test("an item row opens its photo, and its ⋯ archives it, without opening the item", async ({ page }) => {
  const { ids, names } = await aRow();
  await anyPhoto(page);
  await signInAsNewPerson(page, "Row Admin", "admin");
  await page.goto("/inventory");

  await page.getByRole("button", { name: `Open the photo of ${names.item}` }).filter({ visible: true }).click();
  const photo = page.getByRole("dialog", { name: names.item });
  await expect(photo.getByRole("img")).toBeVisible();
  await photo.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/inventory$/);

  await more(page, names.item).click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toHaveAttribute(
    "href",
    `/inventory/${ids.item}/edit?back=${encodeURIComponent("/inventory")}`,
  );
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();

  // The snackbar, once it has committed; the Archived chip has the same word.
  await expect(page.getByRole("region", { name: /Notifications/ }).getByText("Archived")).toBeVisible();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(more(page, names.item)).toHaveCount(0);
  await page.goto("/inventory?archived=1");
  await expect(more(page, names.item)).toBeVisible();
});

// Desktop rows open from anywhere on them, without covering the page: a link
// stretched over every row once sent each filter click to the list's last item.
test("a row opens from any cell, and the filters above the rows still filter", async ({ page }) => {
  test.skip(isPhone(page), "a phone row is its own link");
  const { ids, names } = await aRow();
  await signInAsNewPerson(page, "Row Opener");

  await page.goto(`/events?client=${ids.client}`);
  await page.getByRole("row").filter({ hasText: names.event }).locator("td").nth(1).click();
  await expect(page).toHaveURL(new RegExp(`/events/${ids.event}$`));

  await page.goto("/inventory");
  const archived = page.getByRole("link", { name: "Archived", exact: true });
  await archived.click();
  await expect(page).toHaveURL(/\/inventory\?archived=1$/);
  await archived.click();
  await expect(page).toHaveURL(/\/inventory$/);
  // Its Count, well clear of the name's link.
  await page.getByRole("row").filter({ hasText: names.item }).locator("td").nth(5).click();
  await expect(page).toHaveURL(new RegExp(`/inventory/${ids.item}$`));
});
