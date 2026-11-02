import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signInAsNewPerson } from "./sign-in";

test("a change shows in Activity under Today, by who made it, and the type tabs and person chip filter it", async ({ page }) => {
  const tag = randomUUID().slice(0, 8);
  const person = `Ada ${tag}`;
  const place = `Annex ${tag}`;
  await signInAsNewPerson(page, person, "admin");

  await page.goto("/settings#locations");
  const locations = page.getByRole("region", { name: "Locations", exact: true });
  await locations.getByRole("button", { name: "Add Location", exact: true }).click();
  const adding = page.getByRole("dialog", { name: "Add a Location" });
  await adding.getByLabel("Name").fill(place);
  await adding.getByRole("button", { name: "Add Location", exact: true }).click();
  await expect(adding).toBeHidden();

  await page.getByRole("button", { name: `Account: ${person}` }).filter({ visible: true }).click();
  await page.getByRole("menuitem", { name: "Activity", exact: true }).click();
  await expect(page).toHaveURL(/\/activity$/);
  const main = page.getByRole("main");
  const today = main.getByRole("region", { name: "Today", exact: true });
  const entry = today.getByRole("listitem").filter({ hasText: `${person} added Location ${place}` });
  await expect(entry).toBeVisible();
  await expect(entry.locator("time")).toHaveText(/^\d{1,2}:\d{2}\s?[AP]M$/);

  await main.getByRole("button", { name: "Person", exact: true }).click();
  await page.getByRole("menuitem", { name: person, exact: true }).click();
  await expect(page).toHaveURL(/person=/);
  await expect(main.getByRole("listitem")).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath("activity.png") });

  await main.getByRole("link", { name: "People", exact: true }).click();
  await expect(main.getByText("Nothing matches these filters.")).toBeVisible();
  await main.getByRole("link", { name: "Stock", exact: true }).click();
  await expect(page).toHaveURL(/type=stock/);
  await expect(page).toHaveURL(/person=/);
  await expect(entry).toBeVisible();
});
