import { expect, type Page } from "@playwright/test";

/**
 * A Settings card's row with this text. The e2e database is shared, so a card
 * often shows only its first eight: one with search is searched, and any
 * other is opened with "View N more". Retried until the page has hydrated.
 */
export async function settingsRow(page: Page, card: string, text: string) {
  const region = page.getByRole("region", { name: card, exact: true });
  const row = region.getByRole("listitem").filter({ hasText: text });
  const search = region.getByRole("searchbox", { name: `Search ${card}`, exact: true });
  const more = region.getByRole("button", { name: /^View \d+ more$/ });
  await expect(async () => {
    if (await search.count()) {
      await search.fill("");
      await search.fill(text);
    } else if (await more.isVisible()) {
      await more.click();
    }
    await expect(row).toBeVisible({ timeout: 1_000 });
  }).toPass();
  return row;
}
