import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { settingsRow } from "./settings-rows";
import { signInAsNewPerson } from "./sign-in";

async function fixture() {
  const db = new Client({ connectionString: e2eDatabaseURL });
  await db.connect();
  const tag = randomUUID().slice(0, 8);
  const ids = { category: randomUUID(), other: randomUUID(), item: randomUUID(), archived: randomUUID(), location: randomUUID() };
  const names = { category: `Decor ${tag}`, other: `Furniture ${tag}`, item: `Vase ${tag}`, location: `Warehouse ${tag}` };
  try {
    await db.query("insert into category (id, name) values ($1, $2), ($3, $4)", [ids.category, names.category, ids.other, names.other]);
    await db.query("insert into location (id, name) values ($1, $2)", [ids.location, names.location]);
    await db.query("insert into item (id, kind, name, category_id, archived_at) values ($1, 'inventory', $2, $3, null), ($4, 'inventory', 'Archived vase', $3, now())", [ids.item, names.item, ids.category, ids.archived]);
    await db.query("insert into stock (item_id, location_id, count) values ($1, $2, 5)", [ids.item, ids.location]);
  } finally {
    await db.end();
  }
  return { ids, names, tag };
}

test("an Admin adds and renames a category, requires it on Add Item, and keeps combined filters after editing", async ({ page }) => {
  const { ids, names, tag } = await fixture();
  await signInAsNewPerson(page, "Category Admin", "admin");
  await page.goto("/settings#categories");
  const settings = page.getByRole("region", { name: "Categories", exact: true });
  await settings.getByRole("button", { name: "Add Category", exact: true }).click();
  const adding = page.getByRole("dialog", { name: "Add a Category" });
  await adding.getByLabel("Name").fill(`Tabletop ${tag}`);
  await adding.getByRole("button", { name: "Add Category", exact: true }).click();
  await expect(adding).toBeHidden();
  await (await settingsRow(page, "Categories", `Tabletop ${tag}`)).getByRole("button", { name: `More for Tabletop ${tag}` }).click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const renaming = page.getByRole("dialog", { name: `Rename Tabletop ${tag}` });
  const categoryName = `Vessels ${tag}`;
  await renaming.getByLabel("Name").fill(categoryName);
  await renaming.getByRole("button", { name: "Save", exact: true }).click();
  await expect(renaming).toBeHidden();
  await settingsRow(page, "Categories", categoryName);
  await page.locator("#categories").screenshot({ path: test.info().outputPath("categories-settings.png") });

  const itemName = `Bud Vase ${tag}`;
  await page.goto("/inventory/new");
  await page.getByLabel("Name", { exact: true }).fill(itemName);
  const select = page.getByLabel("Category", { exact: true }).filter({ visible: true });
  await expect(select).toHaveValue("");
  await page.getByRole("button", { name: "Add Item", exact: true }).click();
  await expect(select).toHaveJSProperty("required", true);
  await expect(page).toHaveURL(/\/inventory\/new$/);
  await select.selectOption({ label: categoryName });
  await page.getByLabel("Location", { exact: true }).selectOption({ label: names.location });
  await page.getByLabel("Count", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Add Item", exact: true }).click();
  await expect(page.getByRole("heading", { name: itemName, exact: true })).toBeVisible();
  await expect(page.getByText(`Category: ${categoryName}`, { exact: true })).toBeVisible();

  await page.goto("/inventory");
  await page.getByRole("button", { name: "Category", exact: true }).click();
  await page.getByRole("menuitem", { name: categoryName, exact: true }).click();
  await page.getByRole("button", { name: "Location", exact: true }).click();
  await page.getByRole("menuitem", { name: names.location, exact: true }).click();
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await page.getByLabel("From", { exact: true }).fill("2099-05-10");
  await page.getByLabel("To", { exact: true }).fill("2099-05-12");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("link", { name: new RegExp(`^${itemName}(?:$| )`) }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`^${names.item}(?:$| )`) }).filter({ visible: true })).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.searchParams.get("from") === "2099-05-10" && url.searchParams.get("to") === "2099-05-12");
  const filteredURL = page.url();
  expect(new URL(filteredURL).searchParams.get("category")).toBeTruthy();
  expect(new URL(filteredURL).searchParams.get("location")).toBe(ids.location);
  await page.screenshot({ path: test.info().outputPath("category-filter.png") });
  await page.getByRole("button", { name: `More for ${itemName}` }).filter({ visible: true }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Category", { exact: true }).filter({ visible: true }).locator("option:checked")).toHaveText(categoryName);
  await page.getByLabel("Description").fill("A glass vase.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(filteredURL);
  await page.reload();
  await expect(page.getByRole("button", { name: `Category: ${categoryName}`, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Clear Category", exact: true }).click();
  await expect(page).toHaveURL((url) => !url.searchParams.has("category"));
  expect(new URL(page.url()).searchParams.get("location")).toBe(ids.location);
  expect(new URL(page.url()).searchParams.get("from")).toBe("2099-05-10");

  await page.goto("/gifts/new");
  await expect(page.getByLabel("Category", { exact: true }).filter({ visible: true })).toHaveCount(0);
  await page.goto("/gifts");
  await expect(page.getByRole("button", { name: "Category", exact: true })).toHaveCount(0);
});

test("deleting a category leaves its items Unassigned, findable and able to be recategorized", async ({ page }) => {
  const { ids, names } = await fixture();
  await signInAsNewPerson(page, "Category Deletion Admin", "admin");
  await page.goto("/settings#categories");
  const row = await settingsRow(page, "Categories", names.category);
  await expect(row).toContainText("2 Inventory Items");
  await row.getByRole("button", { name: `More for ${names.category}` }).click();
  await page.getByRole("menuitem", { name: "Delete Category", exact: true }).click();
  const deleting = page.getByRole("dialog", { name: `Delete ${names.category}?`, exact: true });
  await expect(deleting).toContainText("Unassigned");
  await deleting.getByRole("button", { name: "Delete Category", exact: true }).click();
  await expect(deleting).toBeHidden();
  await expect(row).toHaveCount(0);
  await page.goto(`/inventory?category=unassigned&location=${ids.location}`);
  await page.getByRole("link", { name: new RegExp(`^${names.item}(?:$| )`) }).filter({ visible: true }).click();
  await expect(page.getByText("Category: Unassigned", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Count 5", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Category", { exact: true }).filter({ visible: true })).toHaveValue("");
  await page.getByLabel("Category", { exact: true }).filter({ visible: true }).selectOption(ids.other);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(`Category: ${names.other}`, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Count 5", exact: true })).toBeVisible();
});

test("a Category's name in Settings opens Inventory filtered to it", async ({ page }) => {
  const { ids, names } = await fixture();
  await signInAsNewPerson(page, "Category Link User");
  await page.goto("/settings#categories");
  await (await settingsRow(page, "Categories", names.category)).getByRole("link", { name: names.category, exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/inventory" && url.searchParams.get("category") === ids.category);
  await expect(page.getByRole("button", { name: `Category: ${names.category}`, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`^${names.item}(?:$| )`) }).filter({ visible: true })).toBeVisible();
});

test("a User can add Categories but cannot rename or delete them", async ({ page }) => {
  const tag = randomUUID().slice(0, 8);
  await signInAsNewPerson(page, "Category User");
  await page.goto("/settings#categories");
  const settings = page.getByRole("region", { name: "Categories", exact: true });
  await expect(settings.getByRole("button", { name: /^More for / })).toHaveCount(0);
  await settings.getByRole("button", { name: "Add Category", exact: true }).click();
  const adding = page.getByRole("dialog", { name: "Add a Category" });
  await adding.getByLabel("Name").fill(`Games ${tag}`);
  await adding.getByRole("button", { name: "Add Category", exact: true }).click();
  await expect(adding).toBeHidden();
  await settingsRow(page, "Categories", `Games ${tag}`);
  await expect(settings.getByRole("button", { name: /^More for / })).toHaveCount(0);
});
