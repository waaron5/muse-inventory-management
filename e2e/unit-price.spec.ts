import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { signInAsNewPerson } from "./sign-in";

test("Unit Price keeps its $ ahead and takes only a price", async ({ page }) => {
  const tag = randomUUID().slice(0, 8);
  const name = `Tote ${tag}`;
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  try {
    await client.query(`insert into location (id, name) values ($1, $2)`, [randomUUID(), `Closet ${tag}`]);
  } finally {
    await client.end();
  }
  await signInAsNewPerson(page, `Pricer ${tag}`, "admin");

  await page.goto("/gifts/new");
  await page.getByLabel("Name").fill(name);
  // A route left behind stays mounted, hidden, so look only at the one on screen.
  const price = page.getByLabel("Unit Price").filter({ visible: true });
  const dollar = page.locator("label").filter({ has: price }).getByText("$", { exact: true });
  await expect(dollar).toBeVisible();

  await price.pressSequentially("$1,2a5.505");
  await expect(price).toHaveValue("125.50");
  // The $ sits ahead of what's typed, not over it.
  const [sign, field] = [await dollar.boundingBox(), await price.boundingBox()];
  expect(sign!.x).toBeGreaterThan(field!.x);
  expect(sign!.x + sign!.width).toBeLessThan(field!.x + 24);

  await page.getByLabel("Location", { exact: true }).selectOption({ label: `Closet ${tag}` });
  await page.getByRole("button", { name: "Add Gift" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("main").getByText("$125.50")).toBeVisible();

  // Editing shows the saved price after the same $.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit Gift" })).toBeVisible();
  await expect(price).toHaveValue("125.50");
});
