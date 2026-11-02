import { expect, type Page, test } from "@playwright/test";
import { signInAsNewPerson } from "./sign-in";

// The page's own background: --bg in each theme (globals.css).
const light = "rgb(255, 255, 255)";
const dark = "rgb(22, 22, 24)";

function expectBody(page: Page) {
  return expect(page.locator("body"));
}

function square(page: Page, appearance: "Light" | "Dark" | "System") {
  return page.getByRole("menuitemradio", { name: appearance });
}

/** Chooses an Appearance in the account menu until it shows: a click before the shell hydrates goes nowhere. */
async function choose(page: Page, appearance: "Light" | "Dark" | "System", shows: string) {
  await expect(async () => {
    if (!(await page.getByRole("menu").isVisible())) {
      await page.getByRole("button", { name: /^Account:/ }).filter({ visible: true }).click();
    }
    await square(page, appearance).click();
    await expectBody(page).toHaveCSS("background-color", shows, { timeout: 1_000 });
  }).toPass();
}

test("follows the system live until an Appearance is chosen, on this device", async ({ page }) => {
  await signInAsNewPerson(page, "Robin Theme");
  await page.goto("/events");

  await page.emulateMedia({ colorScheme: "light" });
  await expectBody(page).toHaveCSS("background-color", light);
  await page.emulateMedia({ colorScheme: "dark" });
  await expectBody(page).toHaveCSS("background-color", dark);

  await choose(page, "Light", light);
  await expect(square(page, "System")).toHaveAttribute("aria-checked", "false");
  await expect(square(page, "Light")).toHaveAttribute("aria-checked", "true");
  // The menu stays open, so another choice is one more click.
  await square(page, "Dark").click();
  await page.emulateMedia({ colorScheme: "light" });
  await expectBody(page).toHaveCSS("background-color", dark);

  // Another tab on this device sees the choice.
  const other = await page.context().newPage();
  await other.emulateMedia({ colorScheme: "light" });
  await other.goto("/events");
  await expectBody(other).toHaveCSS("background-color", dark);
  await square(page, "System").click();
  await expectBody(other).toHaveCSS("background-color", light);
});

test("a reload in Dark is dark before the app's JavaScript runs, and prints light", async ({ page }) => {
  await signInAsNewPerson(page, "Dark Reloader");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/events");
  await choose(page, "Dark", dark);

  // With only the HTML and its inline script, the first paint is already dark.
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.reload();
  await expectBody(page).toHaveCSS("background-color", dark);
  await page.unroute("**/_next/static/**/*.js");

  await page.reload();
  await page.getByRole("button", { name: /^Account:/ }).filter({ visible: true }).click();
  await expect(square(page, "Dark")).toHaveAttribute("aria-checked", "true");
  await page.emulateMedia({ media: "print" });
  await expectBody(page).toHaveCSS("background-color", light);
});
