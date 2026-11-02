import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { settingsRow } from "./settings-rows";
import { signInAsNewPerson, signInFirstTime, subjectsEmailedTo } from "./sign-in";

test("an Admin invites someone, who signs in, then deactivates them", async ({ page, browser }) => {
  await signInAsNewPerson(page, "Ada Okafor", "admin");
  await page.getByRole("button", { name: "Account: Ada Okafor" }).filter({ visible: true }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  const email = `e2e-${randomUUID()}@museem.com`;
  await page.getByRole("button", { name: "Invite" }).click();
  const inviting = page.getByRole("dialog", { name: "Invite someone" });
  await inviting.getByLabel("Email").fill(email);
  await expect(inviting.getByText("Add any email that ends in @museem.com")).toBeVisible();
  await expect(inviting.getByLabel("Role", { exact: true })).toHaveCount(0);
  await inviting.getByRole("button", { name: "Invite" }).click();
  await expect(inviting).toBeHidden();
  await settingsRow(page, "Users", email);
  expect(await subjectsEmailedTo(email)).toContain("You've been added to Muse Inventory");

  // The e2e database is shared, so names alone don't single anyone out.
  const name = `Ben ${randomUUID().slice(0, 6)}`;
  const theirs = await browser.newContext();
  const them = await theirs.newPage();
  await signInFirstTime(them, email, name);

  await page.reload();
  const row = await settingsRow(page, "Users", email);
  const colour = await row.locator(".avatar").evaluate((el) => Number(getComputedStyle(el).getPropertyValue("--avatar-hue")));
  const accountAvatar = them.getByRole("button", { name: `Account: ${name}` }).filter({ visible: true }).locator(".avatar");
  await expect.poll(() => accountAvatar.evaluate((el) => Number(getComputedStyle(el).getPropertyValue("--avatar-hue")))).toBe(colour);
  await row.getByRole("button", { name: `More for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  const deactivating = page.getByRole("dialog", { name: `Deactivate ${name}?` });
  await deactivating.getByRole("button", { name: "Deactivate" }).click();
  await expect(deactivating).toBeHidden();
  // Deactivated people sort last, so perhaps past the first eight.
  await expect(await settingsRow(page, "Users", email)).toContainText("Deactivated");

  // Their screens may show for a few minutes more, but they can change nothing.
  await them.goto("/settings");
  await them.getByRole("button", { name: "Edit name" }).click();
  await them.getByLabel("Your name").fill("Ben I.");
  await them.getByRole("button", { name: "Save name" }).click();
  await expect(them.getByText("Sign in again to continue.")).toBeVisible();
  await theirs.close();
});

test("a User sees who has access, but none of the Users screen's actions", async ({ page }) => {
  const email = await signInAsNewPerson(page, "Cleo Marsh");
  await page.getByRole("button", { name: "Account: Cleo Marsh" }).filter({ visible: true }).click();
  await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Users" })).toHaveCount(0);

  // The Users card of the one Settings page, beside Clients, whose colour menu is everyone's.
  await page.goto("/users");
  const users = page.getByRole("region", { name: "Users", exact: true });
  await expect(await settingsRow(page, "Users", email)).toContainText("Cleo Marsh · You");
  await expect(users.getByRole("button", { name: "Invite" })).toHaveCount(0);
  await expect(users.getByRole("button", { name: /^More for / })).toHaveCount(0);
});
