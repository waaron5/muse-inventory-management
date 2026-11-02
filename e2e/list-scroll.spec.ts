import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { signInAsNewPerson } from "./sign-in";

for (const section of ["Events", "Inventory", "Gifts"] as const) {
  test(`${section} scrolls its rows while its controls stay in place`, async ({ page }) => {
    const email = await signInAsNewPerson(page, "Scroll Tester");
    const client = new Client({ connectionString: e2eDatabaseURL });
    await client.connect();
    const id = randomUUID();
    const prefix = `Scroll ${id.slice(0, 8)}`;
    let route: string;
    try {
      if (section === "Events") {
        await client.query("insert into client (id,name) values ($1,$2)", [id, prefix]);
        await client.query(
          "insert into event (name,client_id,starts_on) select $1 || ' ' || lpad(n::text,2,'0'),$2::uuid,'2030-06-10' from generate_series(1,40) n",
          [prefix, id],
        );
        route = `/events?client=${id}`;
      } else {
        await client.query("insert into location (id,name) values ($1,$2)", [id, prefix]);
        await client.query(
          "with added as (insert into item (kind,name,sku) select $1,$2 || ' ' || lpad(n::text,2,'0'),$3 from generate_series(1,40) n returning id) insert into stock (item_id,location_id,count) select id,$3::uuid,1 from added",
          [section === "Gifts" ? "gift" : "inventory", prefix, id],
        );
        await client.query(
          "insert into history_entry (item_id,kind,count,to_location_id,by_user_id,happened_on) select s.item_id,'starting-stock',s.count,s.location_id,u.id,current_date from stock s cross join \"user\" u where s.location_id=$1 and u.email=$2",
          [id, email],
        );
        route = `/${section.toLowerCase()}?location=${id}`;
      }

      await page.goto(route);
      const rows = page.getByRole("region", { name: `${section} list`, exact: true });
      const rowLink = (number: string) => rows.getByRole("link", { name: new RegExp(`^${prefix} ${number}(?: |$)`) }).filter({ visible: true });
      const title = page.getByRole("heading", { level: 1, name: section, exact: true });
      const filter = page.getByRole("button", { name: `${section === "Events" ? "Client" : "Location"}: ${prefix}`, exact: true });
      await expect(rowLink("40")).toHaveCount(1);
      const titleTop = (await title.boundingBox())!.y;
      const filterTop = (await filter.boundingBox())!.y;
      const headings = rows.getByRole("columnheader", { name: "Name", exact: true });
      const headingTop = await headings.isVisible() ? (await headings.boundingBox())!.y : null;
      await page.screenshot({ path: test.info().outputPath(`${section.toLowerCase()}-rows.png`) });

      // Mouse/touchpad scrolling stays inside the list, including at its end.
      await rows.hover();
      await page.mouse.wheel(0, 800);
      await expect.poll(() => rows.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      await expect(title).toBeInViewport();
      expect((await title.boundingBox())!.y).toBe(titleTop);
      expect((await filter.boundingBox())!.y).toBe(filterTop);
      if (headingTop !== null) expect(Math.abs((await headings.boundingBox())!.y - headingTop)).toBeLessThan(2);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      await rowLink("40").scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 2000);
      expect((await title.boundingBox())!.y).toBe(titleTop);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(1);

      // The same region is keyboard-scrollable without moving the page.
      await rows.evaluate(el => el.scrollTo(0, 0));
      await rows.focus();
      await page.keyboard.press("PageDown");
      await expect.poll(() => rows.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      expect((await title.boundingBox())!.y).toBe(titleTop);

      // Navigating out restores normal document scrolling for forms.
      await rowLink("01").click();
      await expect(page.getByRole("heading", { level: 1, name: `${prefix} 01`, exact: true })).toBeVisible();
      await expect(page.locator(".app-shell")).toHaveCSS("overflow-y", "visible");
      await page.goBack();
      await expect(page.getByRole("region", { name: `${section} list`, exact: true })).toBeVisible();
    } finally {
      if (section === "Events") {
        await client.query("delete from event where client_id=$1", [id]);
        await client.query("delete from client where id=$1", [id]);
      } else {
        await client.query("delete from history_entry where to_location_id=$1", [id]);
        await client.query("delete from stock where location_id=$1", [id]);
        await client.query("delete from item where sku=$1", [id]);
        await client.query("delete from location where id=$1", [id]);
      }
      await client.end();
    }
  });
}
