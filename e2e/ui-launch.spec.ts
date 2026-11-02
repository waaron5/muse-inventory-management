import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { settingsRow } from "./settings-rows";
import { signInAsNewPerson } from "./sign-in";

test("enlarges row photos, edits Count and Location, and deletes an occupied Location from Settings", async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await signInAsNewPerson(page, "Launch Admin", "admin");
  await expect(page.getByRole("link", { name: /^View team,/ })).toBeVisible();
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = { item: randomUUID(), at: randomUUID(), other: randomUUID(), photo: randomUUID() };
  const tag = ids.item.slice(0, 8);
  const name = `Launch Chair ${tag}`;
  const place = `Launch Display ${tag}`;
  try {
    await client.query("insert into location (id,name) values ($1,$2),($3,$4)", [ids.at, place, ids.other, `Launch Garage ${tag}`]);
    // Furniture, seeded by the Categories migration: saving the edit form needs a Category.
    await client.query("insert into item (id,kind,name,photo,category_id) values ($1,'inventory',$2,$3,'60b2a416-bb1a-4d89-bb85-800a27056eb3')", [ids.item, name, ids.photo]);
    await client.query("insert into stock (item_id,location_id,count) values ($1,$2,7)", [ids.item, ids.at]);
    await page.route(`**/api/photos/${ids.photo}*`, (route) => route.fulfill({
      contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480"><rect width="480" height="480" fill="silver"/></svg>',
    }));
    await page.goto(`/inventory?location=${ids.at}`);
    const opener = page.getByRole("button", { name: `Open the photo of ${name}`, exact: true }).filter({ visible: true });
    expect((await opener.boundingBox())!.width).toBe(48);
    const row = opener.locator(isMobile ? "xpath=ancestor::li[1]" : "xpath=ancestor::tr[1]");
    expect((await opener.boundingBox())!.x - (await row.boundingBox())!.x).toBeGreaterThanOrEqual(12);
    await expect(row).toContainText(place);
    if (!isMobile) {
      await opener.hover();
      await expect(opener.locator("span")).toHaveCSS("opacity", "1");
    }
    await opener.click();
    const viewer = page.getByRole("dialog", { name, exact: true });
    await expect(viewer.getByRole("img")).toBeVisible();
    await viewer.getByRole("button", { name: "Close", exact: true }).click();

    await page.goto(`/inventory/${ids.item}`);
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Search", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Move stock|Adjust count)$/ })).toHaveCount(0);
    expect((await page.getByRole("button", { name: `Open the photo of ${name}` }).boundingBox())!.width).toBeGreaterThanOrEqual(96);
    await expect(page.getByText("$-", { exact: false })).toBeVisible();
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Increase Count", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Count 8", exact: true })).toBeVisible();
    await expect(page.getByText(`Location: ${place}`, { exact: true })).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    for (const title of ["My profile", "Users", "Clients", "Locations"]) await expect(page.getByRole("heading", { name: title, exact: true, level: 2 })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("settings-cards.png"), fullPage: true });
    const location = await settingsRow(page, "Locations", place);
    await location.getByRole("button", { name: `More for ${place}` }).click();
    await page.getByRole("menuitem", { name: "Delete Location", exact: true }).click();
    const deleting = page.getByRole("dialog", { name: `Delete ${place}?`, exact: true });
    await expect(deleting).toContainText("orphaned and shown as Unassigned");
    await deleting.getByRole("button", { name: "Delete Location", exact: true }).click();
    await expect(deleting).toBeHidden();
    await expect(location).toHaveCount(0);
    await page.goto(`/inventory/${ids.item}`);
    await expect(page.getByRole("heading", { name: "Count 8", exact: true })).toBeVisible();
    await expect(page.getByText("Location: Unassigned", { exact: true })).toBeVisible();
    // Moving it is a field like any other, and moves all 8.
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await page.getByLabel("Location", { exact: true }).selectOption({ label: `Launch Garage ${tag}` });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`Location: Launch Garage ${tag}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Count 8", exact: true })).toBeVisible();
    await expect(page.getByText(`8 from Unassigned to Launch Garage ${tag}`, { exact: false })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("item-detail.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  } finally {
    await client.query("delete from history_entry where item_id=$1", [ids.item]);
    await client.query("delete from stock where item_id=$1", [ids.item]);
    await client.query("delete from item where id=$1", [ids.item]);
    await client.query("delete from location where id=any($1::uuid[])", [[ids.at, ids.other]]);
    await client.end();
  }
});
