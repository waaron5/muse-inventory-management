import { expect, test } from "@playwright/test";
import { signInAsNewPerson } from "./sign-in";

test("opens the shell on Events and moves between sections", async ({ page }) => {
  await signInAsNewPerson(page, "Shell Tester");
  await page.goto("/");

  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole("heading", { level: 1, name: "Events" })).toBeVisible();

  const nav = page.getByRole("navigation").filter({ visible: true });
  await expect(nav.getByRole("link", { name: "Events" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Gifts" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Gifts" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Gifts" })).toHaveAttribute("aria-current", "page");
});
