import { expect, type Page } from "@playwright/test";

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 800;

/** Presses a search shortcut until search has focus: one pressed before the page hydrates goes nowhere. Returns its field. */
export async function pressShortcut(page: Page, key: string) {
  const field = page.getByRole("combobox", { name: "Search" });
  await expect(async () => {
    await page.keyboard.press(key);
    await expect(field).toBeFocused({ timeout: 1_000 });
  }).toPass();
  return field;
}

/** Opens global search: `/` from 800px, the top bar's icon on phone. Returns its field. */
export async function openSearch(page: Page) {
  if (!isPhone(page)) return pressShortcut(page, "/");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const field = page.getByRole("combobox", { name: "Search" });
  await expect(field).toBeFocused();
  return field;
}
