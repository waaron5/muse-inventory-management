import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { signInAsNewPerson } from "./sign-in";

test("secondary columns centre beside the sidebar while top rows and main lists stay full width", async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  await signInAsNewPerson(page, "Layout Admin", "admin");
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = { client: randomUUID(), event: randomUUID(), item: randomUUID(), gift: randomUUID() };
  const tag = ids.event.slice(0, 8);
  try {
    await client.query("insert into client (id,name) values ($1,$2)", [ids.client, `Layout Client ${tag}`]);
    await client.query("insert into event (id,name,client_id,starts_on) values ($1,$2,$3,'2030-06-10')", [ids.event, `Layout Event ${tag}`, ids.client]);
    await client.query("insert into item (id,kind,name) values ($1,'inventory',$2),($3,'gift',$4)", [ids.item, `Layout Item ${tag}`, ids.gift, `Layout Gift ${tag}`]);
    await client.query("insert into line (event_id,item_id,reserved) values ($1,$2,1),($1,$3,1)", [ids.event, ids.item, ids.gift]);

    if (!isMobile) await page.setViewportSize({ width: 1600, height: 1000 });
    const routes: [path: string, title: string, maximum: number][] = [
      [`/events/${ids.event}`, `Layout Event ${tag}`, 760],
      [`/inventory/${ids.item}`, `Layout Item ${tag}`, 760],
      [`/gifts/${ids.gift}`, `Layout Gift ${tag}`, 760],
      ["/events/new", "Add Event", 560],
      ["/inventory/new", "Add Item", 560],
      ["/gifts/new", "Add Gift", 560],
      [`/events/${ids.event}/edit`, "Edit Event", 560],
      [`/inventory/${ids.item}/edit`, "Edit item", 560],
      [`/gifts/${ids.gift}/edit`, "Edit Gift", 560],
      [`/events/${ids.event}/print`, "Print list", 960],
    ];
    for (const [route, title, maximum] of routes) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
      const column = page.locator("main > .page-column").filter({ visible: true });
      await expect(column).toHaveCount(1);
      const available = await page.getByRole("main").evaluate(el => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return { x: box.x + parseFloat(style.paddingLeft), width: box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
      });
      await expect(column).toHaveCSS("border-left-width", isMobile ? "0px" : "1px");
      await expect(column).toHaveCSS("padding-left", isMobile ? "0px" : "32px");
      await expect.poll(async () => {
        const box = await column.boundingBox();
        return box ? Math.abs(box.width - Math.min(maximum, available.width)) : Infinity;
      }, { message: route }).toBeLessThan(1);
      await expect.poll(async () => {
        const box = await column.boundingBox();
        return box ? Math.abs(box.x - (available.x + (isMobile ? 0 : (available.width - box.width) / 2))) : Infinity;
      }, { message: route }).toBeLessThan(1);
      if (!isMobile) {
        const topRow = page.locator(".page-top-row").filter({ visible: true });
        const top = (await topRow.boundingBox())!;
        expect(Math.abs(top.x - available.x), route).toBeLessThan(1);
        expect(Math.abs(top.width - available.width), route).toBeLessThan(1);
        const action = title === "Print list" ? "Print" : null;
        if (action) await expect(topRow.getByRole("button", { name: action, exact: true })).toBeVisible();
        if (title === "Settings") await page.screenshot({ path: test.info().outputPath("centred-panel.png") });
      }
    }

    for (const section of ["Events", "Inventory", "Gifts"]) {
      await page.goto(`/${section.toLowerCase()}`);
      await expect(page.getByRole("region", { name: `${section} list`, exact: true })).toBeVisible();
      await expect(page.locator(".page-column").filter({ visible: true })).toHaveCount(0);
      const list = await page.locator(".list-page").filter({ visible: true }).boundingBox();
      const mainWidth = await page.getByRole("main").evaluate(el => {
        const style = getComputedStyle(el);
        return el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      });
      expect(Math.abs(list!.width - mainWidth)).toBeLessThan(1);
    }

    if (isMobile) {
      // A wide phone keeps its existing left-aligned form and Settings widths.
      await page.setViewportSize({ width: 700, height: 800 });
      await page.goto("/events/new");
      const form = page.getByRole("main").locator("form");
      await expect(form.getByLabel("Event Name", { exact: true })).toBeVisible();
      expect((await form.boundingBox())!.x).toBe(16);
      expect((await form.boundingBox())!.width).toBe(560);
      await page.goto("/settings");
      const cards = page.locator(".page-column").filter({ visible: true });
      await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
      await expect(cards).toHaveCount(5);
      expect((await cards.first().boundingBox())!.x).toBe(16);
      expect((await cards.first().boundingBox())!.width).toBe(668);
    }
  } finally {
    await client.query("delete from line where event_id=$1", [ids.event]);
    await client.query("delete from event where id=$1", [ids.event]);
    await client.query("delete from item where id=any($1::uuid[])", [[ids.item, ids.gift]]);
    await client.query("delete from client where id=$1", [ids.client]);
    await client.end();
  }
});
