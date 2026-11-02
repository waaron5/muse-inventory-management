import { expect, test } from "@playwright/test";
import { codeEmailedTo, invite } from "./sign-in";

test("refuses a second code within a minute", async ({ page }) => {
  const email = await invite();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(`A code has been sent to ${email}.`)).toBeVisible();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Too many tries. Wait a while and try again.")).toBeVisible();
});

test("signs in by emailed code, asks a new person's name, and signs out", async ({ page }) => {
  const email = await invite();

  await page.goto("/events");
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(`A code has been sent to ${email}.`)).toBeVisible();
  await page.getByLabel("Code").fill(await codeEmailedTo(email));
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByLabel("Your name").fill("Robin Ellis");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/events$/);
  const account = page.getByRole("button", { name: "Account: Robin Ellis" }).filter({ visible: true });
  await account.click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/events");
  await expect(page).toHaveURL(/\/sign-in$/);
});
