import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";
import { openSearch } from "./search";
import { signInAsNewPerson } from "./sign-in";

const heic = path.join(process.cwd(), "e2e", "fixtures", "iphone-photo.heic");

/** Picks the HEIC through the photo tile's file chooser. */
async function choosePhoto(page: Page) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^(Choose|Replace) photo$/ }).click();
  await (await chooser).setFiles(heic);
}

/** A row straight into the database, its id returned. */
async function insert(sql: string, name: (id: string) => string) {
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  const id = randomUUID();
  try {
    await client.query(sql, [id, name(id)]);
  } finally {
    await client.end();
  }
  return id;
}

/** An Inventory Item with nothing else yet. */
const anItem = () => insert(`insert into item (id, kind, name) values ($1, 'inventory', $2)`, (id) => `Arch ${id.slice(0, 8)}`);

/**
 * Stands in for Blob storage in the browser: the smoke has no store of its
 * own. Hands out a token, keeps what's uploaded, and serves it back.
 */
async function fakeStorage(page: Page) {
  const stored = new Map<string, Buffer>();
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  await page.route("**/api/photos/upload", (route) =>
    route.fulfill({ json: { type: "blob.generate-client-token", clientToken: "vercel_blob_client_e2e_e30" } }),
  );
  await page.route("https://vercel.com/api/blob/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const pathname = new URL(request.url()).searchParams.get("pathname")!;
    stored.set(pathname, request.postDataBuffer()!);
    const url = `https://e2e.private.blob.vercel-storage.com/${pathname}`;
    await route.fulfill({
      headers: cors,
      json: { url, downloadUrl: url, pathname, contentType: "image/jpeg", contentDisposition: "inline", etag: "e2e" },
    });
  });
  await page.route(/\/api\/photos\/[0-9a-f-]{36}/, (route) => {
    const url = new URL(route.request().url());
    const key = url.pathname.split("/").pop();
    const body = stored.get(`photos/${key}${url.searchParams.get("size") === "small" ? "-small" : ""}.jpg`);
    return body ? route.fulfill({ contentType: "image/jpeg", body }) : route.fulfill({ status: 404 });
  });
  return stored;
}

test("an iPhone HEIC photo is stored and shown as JPEG, and its uploader deletes it", async ({ page }) => {
  const itemId = await anItem();
  const stored = await fakeStorage(page);
  await signInAsNewPerson(page, "Photo Tester");
  await page.goto(`/inventory/${itemId}`);

  await page.getByRole("button", { name: "Add photo" }).click();
  const adding = page.getByRole("dialog", { name: "Add a photo" });
  await choosePhoto(page);
  await expect(adding.getByRole("button", { name: "Replace photo" })).toBeVisible({ timeout: 30_000 });
  await adding.getByLabel("Note (optional)").fill("Two rows by the stage");
  await adding.getByRole("button", { name: "Add photo" }).click();
  await expect(adding).toBeHidden({ timeout: 30_000 });

  // Both copies went up as JPEG, the small one 480px across.
  expect([...stored.keys()].sort()).toEqual([
    expect.stringMatching(/^photos\/[0-9a-f-]{36}-small\.jpg$/),
    expect.stringMatching(/^photos\/[0-9a-f-]{36}\.jpg$/),
  ]);
  for (const body of stored.values()) expect(body.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  const tile = page.getByRole("img", { name: "Two rows by the stage" });
  await expect.poll(() => tile.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(480);

  await tile.click();
  const opened = page.getByRole("dialog", { name: "Photo" });
  await expect(opened.getByText("Added by Photo Tester")).toBeVisible();
  await expect
    .poll(() => opened.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1200);
  await opened.getByRole("button", { name: "Delete photo" }).click();
  const confirming = page.getByRole("dialog", { name: "Delete this photo?" });
  await confirming.getByRole("button", { name: "Delete photo" }).click();
  await expect(confirming).toBeHidden();
  await expect(tile).toHaveCount(0);
});

test("an Admin adds an item with its Item Photo, then replaces it", async ({ page }) => {
  const stored = await fakeStorage(page);
  await signInAsNewPerson(page, "Catalog Tester", "admin");
  const name = `Arch ${randomUUID().slice(0, 8)}`;
  await insert(`insert into location (id, name) values ($1, $2)`, () => `Shelf ${name}`);

  await page.goto("/inventory/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Furniture" });
  await page.getByLabel("Location", { exact: true }).selectOption({ label: `Shelf ${name}` });
  await choosePhoto(page);
  await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Add Item" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const first = [...stored.keys()];

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await choosePhoto(page);
  await expect.poll(() => stored.size, { timeout: 30_000 }).toBe(4);
  // Uploaded, then saved: the button says "Uploading…" until both are done.
  await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible();
  await page.goto("/inventory");
  await (await openSearch(page)).fill(name);
  const thumb = page.getByRole("option", { name }).locator(`img[src^="/api/photos/"]`);
  await expect(thumb).toHaveAttribute("src", /size=small/);
  // Search shows the new photo, not the one it replaced.
  const shown = (await thumb.getAttribute("src"))!.match(/photos\/([0-9a-f-]{36})/)![1];
  expect(first.join()).not.toContain(shown);
});
