import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { signInAsNewPerson } from "./sign-in";
import { todayInMuse } from "../src/lib/time-zone";

/** Two Events for one Client in adjacent months, straight into the database. */
async function twoEvents() {
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const ids = { client: randomUUID(), june: randomUUID(), july: randomUUID() };
  const tag = ids.client.slice(0, 8);
  const names = { june: `June Summit ${tag}`, july: `July Retreat ${tag}` };
  try {
    await client.query(`insert into client (id, name) values ($1, $2)`, [ids.client, `Acme ${tag}`]);
    await client.query(
      `insert into event (id, name, client_id, starts_on, ends_on) values
        ($1, $2, $5, '2030-06-10', '2030-06-12'),
        ($3, $4, $5, '2030-07-01', '2030-07-02')`,
      [ids.june, names.june, ids.july, names.july, ids.client],
    );
  } finally {
    await client.end();
  }
  return { ids, names };
}

// Phone and desktop each render their own rows; only one set is on screen.
const row = (page: Page, name: string) => page.getByRole("link", { name }).filter({ visible: true });

test("Events narrow to the chosen month, keeping the Client in the URL", async ({ page }) => {
  const { ids, names } = await twoEvents();
  await signInAsNewPerson(page, "Filter Tester");
  await page.goto(`/events?client=${ids.client}`);
  await expect(row(page, names.july)).toBeVisible();


  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Year", { exact: true }).selectOption("2030");
  await page.getByRole("dialog").getByRole("link", { name: "June", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/events\\?client=${ids.client}&month=2030-06&year=2030$`));
  await expect(row(page, names.june)).toBeVisible();
  await expect(row(page, names.july)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "Month: June 2030", exact: true })).toBeVisible();
  await expect(row(page, names.july)).toHaveCount(0);
  await page.getByRole("link", { name: /^Past \d/ }).click();
  await expect(page).toHaveURL(new RegExp(`/events\\?tab=past&client=${ids.client}&month=2030-06&year=2030$`));
  await page.getByRole("link", { name: /^Upcoming \d/ }).click();
  await expect(row(page, names.june)).toBeVisible();

  await page.getByRole("link", { name: "Clear Month" }).click();
  await expect(page).toHaveURL(new RegExp(`/events\\?client=${ids.client}$`));
  await expect(row(page, names.july)).toBeVisible();

  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Year", { exact: true })).toHaveValue("");
  await page.getByRole("dialog").getByRole("link", { name: "September", exact: true }).click();
  const [year, currentMonth] = todayInMuse().split("-").map(Number);
  await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe(`${year + (currentMonth > 9 ? 1 : 0)}-09`);
  await page.getByRole("link", { name: /^Past \d/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe(`${year - (currentMonth < 9 ? 1 : 0)}-09`);
});
