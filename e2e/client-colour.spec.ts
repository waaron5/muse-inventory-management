import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { settingsRow } from "./settings-rows";
import { signInAsNewPerson } from "./sign-in";

test("a User changes a Client's saved colour in Settings and sees it on Events", async ({ page }) => {
  const db = new Client({ connectionString: e2eDatabaseURL });
  const clientId = randomUUID();
  const eventId = randomUUID();
  const name = `Colour ${clientId.slice(0, 8)}`;
  const eventName = `Summit ${eventId.slice(0, 8)}`;
  await db.connect();
  try {
    await db.query("insert into client (id, name, colour) values ($1, $2, 'rose')", [clientId, name]);
    await db.query("insert into event (id, name, client_id) values ($1, $2, $3)", [eventId, eventName, clientId]);
  } finally {
    await db.end();
  }

  await signInAsNewPerson(page, "Colour User");
  await page.goto("/settings#clients");
  await settingsRow(page, "Clients", name);
  const more = page.getByRole("button", { name: `More for ${name}` });
  await more.hover();
  await expect(more).toHaveCSS("border-top-width", "0px");
  await more.click();
  await expect(page.getByRole("menuitem", { name: "Rename", exact: true })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Change colour" }).click();
  const sheet = page.getByRole("dialog", { name: `Colour for ${name}` });
  await expect(sheet.getByRole("radio", { name: "Rose", exact: true })).toBeChecked();
  await sheet.locator('label[title="Green"]').click();
  await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
  await more.click();
  await page.getByRole("menuitem", { name: "Change colour" }).click();
  await expect(sheet.getByRole("radio", { name: "Rose", exact: true })).toBeChecked();
  await sheet.locator('label[title="Green"]').click();
  await sheet.screenshot({ path: test.info().outputPath("client-colour.png") });
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Client colour saved", { exact: true })).toBeVisible();
  await page.reload();
  const row = await settingsRow(page, "Clients", name);
  await expect(row.locator(".client-green")).toHaveCount(1);
  const settingsTitle = row.getByText(name, { exact: true });
  const settingsDetail = row.getByText("1 Event", { exact: true });
  const titleHeight = await settingsTitle.evaluate((el) => getComputedStyle(el).lineHeight);
  const subtitleHeight = await settingsDetail.evaluate((el) => getComputedStyle(el).lineHeight);

  await page.goto(`/events?client=${clientId}`);
  const link = page.getByRole("link", { name: `${eventName} ${name}`, exact: true }).filter({ visible: true });
  await expect(link).toBeVisible();
  await expect(link.locator("xpath=ancestor::*[self::tr or self::li][1]")).toHaveClass(/client-green/);
  await expect(link.getByText(eventName, { exact: true })).toHaveCSS("line-height", titleHeight);
  await expect(link.getByText(name, { exact: true })).toHaveCSS("line-height", subtitleHeight);
  await expect(link.getByText(name, { exact: true })).toHaveCSS("font-size", "14px");
  await page.screenshot({ path: test.info().outputPath("event-row.png") });

  await link.click();
  await expect(page).toHaveURL(new RegExp(`/events/${eventId}$`));
  await expect(page.getByText(name, { exact: true }).filter({ visible: true }).locator("xpath=..")).toHaveClass(/client-green/);
});
