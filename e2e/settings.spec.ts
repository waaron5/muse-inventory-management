import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { isPhone } from "./search";
import { signInAsNewPerson } from "./sign-in";

test("confirms a profile colour only after choosing a new swatch and keeps it after reload", async ({ page }) => {
  await signInAsNewPerson(page, "Colour Tester");
  await page.goto("/settings");
  const profile = page.getByRole("group", { name: "Profile colour", exact: true });
  const confirm = page.getByRole("button", { name: "Confirm colour", exact: true });
  await expect(profile.getByRole("radio")).toHaveCount(6);
  await expect(page.getByText("Automatic", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Bubble colour", { exact: true })).toHaveCount(0);
  await expect(confirm).toHaveCount(0);

  await profile.locator('label[title="Cyan"]').click();
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(page.getByText("Colour saved", { exact: true })).toBeVisible();
  await expect(confirm).toHaveCount(0);
  await page.reload();
  await expect(profile.getByRole("radio", { name: "Cyan", exact: true })).toBeChecked();
  await profile.locator('label[title="Gold"]').click();
  await expect(confirm).toBeVisible();
  await profile.locator('label[title="Cyan"]').click();
  await expect(confirm).toHaveCount(0);
  await page.locator("#my-profile").screenshot({ path: test.info().outputPath("profile-colours.png") });
});

test("renames yourself in Settings behind the pencil, then signs out", async ({ page }) => {
  await signInAsNewPerson(page, "Robin Ellis");

  await page.goto("/settings");
  const name = page.getByLabel("Your name");
  await expect(name).toHaveAttribute("readonly");
  await expect(page.getByRole("button", { name: "Sign out everywhere" })).toHaveCount(0);

  // Escape puts it back.
  await page.getByRole("button", { name: "Edit name" }).click();
  await name.fill("Nobody");
  await name.press("Escape");
  await expect(name).toHaveValue("Robin Ellis");

  await page.getByRole("button", { name: "Edit name" }).click();
  await name.fill("Robin E. Ellis");
  await name.press("Enter");

  await expect(page.getByText("Name saved")).toBeVisible();
  await expect(name).toHaveAttribute("readonly");
  await expect(
    page.getByRole("button", { name: "Account: Robin E. Ellis" }).filter({ visible: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Account: Robin E. Ellis" }).filter({ visible: true }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("each main page's gear goes to its part of Settings", async ({ page }) => {
  await signInAsNewPerson(page, "Gear Tester");
  for (const { path, label, section } of [
    { path: "/events", label: "Client settings", section: "Clients" },
    { path: "/inventory", label: "Location & category settings", section: "Locations" },
    { path: "/gifts", label: "Location settings", section: "Locations" },
  ]) {
    await page.goto(path);
    const gear = page.getByRole("main").getByRole("link", { name: label, exact: true });
    if (path === "/inventory") {
      // Hovered again until the page has hydrated: a slow runner can hover before it listens.
      await expect(async () => {
        await page.mouse.move(0, 0);
        await gear.hover();
        await expect(page.getByRole("tooltip", { name: label })).toBeVisible({ timeout: 1000 });
      }).toPass();
      await page.screenshot({ path: test.info().outputPath("gear.png") });
    }
    await gear.click();
    await expect(page).toHaveURL(new RegExp(`/settings#${section.toLowerCase()}$`));
    await expect(page.getByRole("heading", { name: section, exact: true })).toBeInViewport();
  }
});

test("a full load of a part of Settings lands on it", async ({ page }) => {
  await signInAsNewPerson(page, "Hash Admin", "admin");
  for (const section of ["Categories", "Clients"]) {
    await page.goto(`/settings#${section.toLowerCase()}`);
    await expect(page.getByRole("heading", { name: section, exact: true })).toBeInViewport();
  }
  await page.goto("/locations");
  await expect(page.getByRole("heading", { name: "Locations", exact: true })).toBeInViewport();
});

test("a Settings card shows eight rows, then the rest, and its search narrows them", async ({ page }) => {
  const tag = randomUUID().slice(0, 8);
  const db = new Client({ connectionString: e2eDatabaseURL });
  await db.connect();
  try {
    for (let i = 1; i <= 10; i++) await db.query("insert into client (id, name) values ($1, $2)", [randomUUID(), `Acme ${tag} ${i}`]);
  } finally {
    await db.end();
  }
  await signInAsNewPerson(page, "Search Tester");
  await page.goto("/settings#clients");
  const clients = page.getByRole("region", { name: "Clients", exact: true });
  const search = clients.getByRole("searchbox", { name: "Search Clients", exact: true });
  const rows = clients.getByRole("listitem");
  await expect(async () => {
    await search.fill("");
    await search.fill(tag);
    await expect(rows).toHaveCount(8, { timeout: 1_000 });
  }).toPass();
  await clients.getByRole("button", { name: "View 2 more", exact: true }).click();
  await expect(rows).toHaveCount(10);
  await expect(clients.getByRole("button", { name: /^View \d+ more$/ })).toHaveCount(0);
  await search.fill(`acme ${tag} 10`);
  await expect(rows).toHaveText([new RegExp(`^Acme ${tag} 10`)]);
  await search.fill(`nobody ${tag}`);
  await expect(clients.getByText("Nothing matches.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Categories", exact: true }).getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Locations", exact: true }).getByRole("searchbox")).toHaveCount(0);
});

test("the Settings heading and menu stay fixed while navigating and scrolling", async ({ page }) => {
  test.skip(isPhone(page), "Phones have no Settings menu.");
  await signInAsNewPerson(page, "Menu Tester");
  await page.goto("/settings");
  const menu = page.getByRole("navigation", { name: "Settings", exact: true });
  const profile = page.locator("#my-profile");
  await expect(profile).toBeVisible();
  const position = (await menu.boundingBox())!;
  expect(position.y).toBe((await profile.boundingBox())!.y);
  const heading = page.getByRole("heading", { name: "Settings", level: 1, exact: true });
  const headingPosition = (await heading.boundingBox())!;
  expect(headingPosition.x).toBe(position.x);
  expect(headingPosition.y).toBeLessThan(position.y);
  await page.screenshot({ path: test.info().outputPath("settings-nav-top.png") });
  await expect(menu.getByRole("link", { name: "My profile", exact: true })).toHaveAttribute("aria-current", "location");
  for (const section of ["Categories", "Clients", "Users"]) {
    const link = menu.getByRole("link", { name: section, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/settings#${section.toLowerCase()}$`));
    await expect(page.getByRole("heading", { name: section, exact: true, level: 2 })).toBeInViewport();
    await expect(link).toHaveAttribute("aria-current", "location");
    await expect(menu).toBeInViewport();
    expect((await menu.boundingBox())!.y).toBe(position.y);
    expect((await menu.boundingBox())!.x).toBe(position.x);
    await expect(heading).toBeInViewport();
    expect((await heading.boundingBox())!.y).toBe(headingPosition.y);
  }
  // It stays at the same viewport coordinates, including at the page's ends.
  for (const fraction of [0, 0.5, 1, 0]) {
    await page.evaluate(fraction => window.scrollTo(0, fraction * (document.documentElement.scrollHeight - innerHeight)), fraction);
    await expect(menu).toBeInViewport();
    expect((await menu.boundingBox())!.y).toBe(position.y);
    expect((await menu.boundingBox())!.x).toBe(position.x);
    if (fraction === 1) {
      await expect(heading).toBeInViewport();
      expect((await heading.boundingBox())!.y).toBe(headingPosition.y);
      await page.screenshot({ path: test.info().outputPath("settings-nav-bottom.png") });
    }
  }
});
