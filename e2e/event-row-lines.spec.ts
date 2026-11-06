import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { isPhone } from "./search";
import { signInAsNewPerson } from "./sign-in";

/** Two Events for one Client and an Inventory Item none of which is in Stock, straight into the database. */
async function plan() {
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = { client: randomUUID(), summit: randomUUID(), gala: randomUUID(), item: randomUUID() };
  const tag = ids.item.slice(0, 8);
  const names = {
    summit: `Summit ${tag}`,
    gala: `Gala ${tag}`,
    chair: `Folding chair ${tag}`,
    booth: `Photo booth ${tag}`,
    plCode: `Acme Summit 2031 - A long P&L code ${tag}`,
    venue: `Harbor Hotel ${tag}`,
  };
  try {
    await client.query(`insert into client (id, name) values ($1, $2)`, [ids.client, `Acme ${ids.client}`]);
    for (const [id, name] of [
      [ids.summit, names.summit],
      [ids.gala, names.gala],
    ]) {
      await client.query(
        `insert into event (id, name, client_id, starts_on, ends_on) values ($1, $2, $3, '2031-05-10', '2031-05-12')`,
        [id, name, ids.client],
      );
    }
    await client.query(`update event set pl_code=$1, venue=$2 where id=$3`, [names.plCode, names.venue, ids.summit]);
    await client.query(`insert into item (id, kind, name) values ($1, 'inventory', $2)`, [ids.item, names.chair]);
  } finally {
    await client.end();
  }
  return { ids, names };
}

test("P&L stays readable as event columns fold, with row navigation and panels intact", async ({ page }) => {
  const { ids, names } = await plan();
  await signInAsNewPerson(page, "P&L Tester");
  await page.goto(`/events?client=${ids.client}`);
  const widths = isPhone(page) ? [390, 799] : [800, 1024, 1280, 1600];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const region = page.getByRole("region", { name: "Events list", exact: true });
    const link = region.getByRole("link", { name: new RegExp(`^${names.summit}`) }).filter({ visible: true });
    await expect(link).toBeVisible();
    const code = region.getByTitle(names.plCode).filter({ visible: true });
    await expect(code).toHaveCount(1);
    await expect(code).toContainText(names.plCode);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await region.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    if (width >= 800) {
      const row = page.getByRole("row", { name: new RegExp(`^${names.summit}`) });
      const gifts = await row.getByRole("button", { name: /^Gifts:/ }).boundingBox();
      const menu = await row.getByRole("button", { name: /^More for/ }).boundingBox();
      expect(gifts).not.toBeNull();
      expect(menu).not.toBeNull();
      expect(menu!.x - (gifts!.x + gifts!.width)).toBeGreaterThanOrEqual(24);
      const header = region.getByRole("columnheader", { name: "P&L", exact: true });
      // The Venue stays under the dates at every width.
      await expect(row.getByTitle(names.venue)).toBeVisible();
      const folded = !(await header.isVisible());
      await expect(region.locator("thead").getByRole("columnheader")).toHaveText(["Name", "Dates", ...(folded ? [] : ["P&L"]), "Inventory", "Gifts", "More"]);
      if (!folded) {
        await expect(code).toHaveJSProperty("tagName", "TD");
      } else {
        await expect(link).toContainText(`P&L: ${names.plCode}`);
      }
      await row.getByRole("button", { name: /^Inventory:/ }).click();
      const panel = page.getByRole("region", { name: `Lines of ${names.summit}` });
      await expect(panel).toBeVisible();
      await expect(panel.locator("xpath=..")).toHaveAttribute("colspan", "6");
      await row.getByRole("button", { name: /^Gifts:/ }).click();
      await expect(panel).toBeHidden();
    }
    await page.screenshot({ path: test.info().outputPath(`pnl-${width}.png`) });
  }
  if (page.viewportSize()!.width >= 800) {
    await page.getByRole("row", { name: new RegExp(`^${names.summit}`) }).getByTitle(names.plCode).filter({ visible: true }).click();
  } else {
    await page.getByRole("link", { name: new RegExp(`^${names.summit}`) }).filter({ visible: true }).click();
  }
  await expect(page).toHaveURL(new RegExp(`/events/${ids.summit}$`));
});

test("an Event's row opens to its Lines, where they're reserved and added as on its page", async ({ page }) => {
  test.skip(isPhone(page), "No panel on phone");
  const { ids, names } = await plan();
  await signInAsNewPerson(page, "Row Lines Tester");
  await page.goto(`/events?client=${ids.client}`);
  const main = page.getByRole("main");

  const row = (name: string) => main.getByRole("row", { name: new RegExp(`^${name}`) });
  const opener = row(names.summit).getByRole("button", { name: /^Inventory:/ });
  const giftsOpener = row(names.summit).getByRole("button", { name: /^Gifts:/ });
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  await opener.click();
  await expect(opener).toHaveAttribute("aria-expanded", "true");
  await expect(giftsOpener).toHaveAttribute("aria-expanded", "true");
  const panel = main.getByRole("region", { name: `Lines of ${names.summit}` });
  const inventory = panel.locator("section").filter({ has: page.getByRole("heading", { name: "Inventory" }) });
  const gifts = panel.locator("section").filter({ has: page.getByRole("heading", { name: "Gifts" }) });
  await expect(inventory.getByRole("listitem")).toHaveCount(0);

  // Several open at once.
  await row(names.gala).getByRole("button", { name: /^Gifts:/ }).click();
  await expect(main.getByRole("region", { name: `Lines of ${names.gala}` })).toBeVisible();

  await inventory.getByRole("button", { name: "Add inventory", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Add inventory", exact: true });
  await picker.getByRole("searchbox", { name: "Search" }).fill(names.chair);
  await page.screenshot({ path: test.info().outputPath("add-item.png") });
  await picker.getByRole("button", { name: new RegExp(names.chair) }).click();
  await picker.getByLabel("How many").fill("3");
  await picker.getByRole("button", { name: "Add", exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByText("Reserved", { exact: true })).toBeVisible();
  await expect(inventory.getByRole("link", { name: names.chair })).toBeVisible();
  // None are in Stock, so the row says it's short.
  await expect(opener).toContainText("1");
  await expect(row(names.summit)).toContainText("Short by 3");

  await inventory.getByRole("button", { name: "Add non-inventory", exact: true }).click();
  const borrow = page.getByRole("dialog", { name: "Add non-inventory", exact: true });
  await borrow.getByLabel("Name").fill(names.booth);
  await borrow.getByLabel("Borrowed from").fill("Lens & Co");
  await borrow.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Borrowed Item added")).toBeVisible();
  await expect(inventory.getByText("Borrowed from Lens & Co")).toBeVisible();
  await expect(opener).toContainText("2");

  // Gifts add only from the catalog.
  await expect(gifts.getByRole("button", { name: "Add non-inventory", exact: true })).toHaveCount(0);
  await gifts.getByRole("button", { name: "Add gift", exact: true }).click();
  const giftPicker = page.getByRole("dialog", { name: "Add gift", exact: true });
  await expect(giftPicker.getByRole("searchbox", { name: "Search" })).toBeVisible();
  await expect(giftPicker.getByLabel("Name")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(giftPicker).toBeHidden();

  // Either count closes it again.
  await giftsOpener.click();
  await expect(panel).toBeHidden();
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  await expect(giftsOpener).toHaveAttribute("aria-expanded", "false");
});
