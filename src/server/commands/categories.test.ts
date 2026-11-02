import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { category, item } from "@/db/schema";
import type { Db } from "@/db/types";
import { addUser, countRoundTrips, testCategoryId, testDb } from "@/test/db";
import { loadCategoriesScreen } from "../loaders/categories";
import { loadInventoryScreen } from "../loaders/inventory";
import { loadGiftScreen, loadItemScreen } from "../loaders/item";
import { createCategory, deleteCategory, renameCategory } from "./categories";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { editInventoryItem } from "./edit-inventory-item";

let db: Db;
let admin: Awaited<ReturnType<typeof addUser>>;
let user: Awaited<ReturnType<typeof addUser>>;
beforeAll(async () => {
  db = await testDb();
  admin = await addUser(db, { role: "admin" });
  user = await addUser(db);
});

describe("Categories", () => {
  it("starts with the five approved categories in alphabetical order", async () => {
    expect((await loadCategoriesScreen(db)).categories.map((c) => c.name)).toEqual([
      "Decor & Tabletop", "Furniture", "Lighting & Candle Holders", "Umbrellas & Shade", "Vases & Vessels",
    ]);
  });

  it("lets a User add a category, but only an Admin rename or delete it", async () => {
    const created = await createCategory(db, user, { name: "  Games  " });
    expect(created.name).toBe("Games");
    await expect(renameCategory(db, user, { categoryId: created.id, name: "Games renamed" })).rejects.toMatchObject({ code: "not-allowed" });
    await expect(deleteCategory(db, user, { id: created.id })).rejects.toMatchObject({ code: "not-allowed" });
    await renameCategory(db, admin, { categoryId: created.id, name: "Activities" });
    expect((await loadInventoryScreen(db, {})).categories).toContainEqual({ id: created.id, name: "Activities" });
    await deleteCategory(db, admin, { id: created.id });
    expect((await loadInventoryScreen(db, {})).categories.map((c) => c.id)).not.toContain(created.id);
  });

  it("refuses blank or overly long names and missing targets", async () => {
    for (const name of ["  ", "x".repeat(101)]) {
      await expect(createCategory(db, admin, { name })).rejects.toMatchObject({ code: "invalid" });
    }
    await expect(renameCategory(db, admin, { categoryId: crypto.randomUUID(), name: "Gone" })).rejects.toMatchObject({ code: "invalid" });
    await expect(deleteCategory(db, admin, { id: crypto.randomUUID() })).rejects.toMatchObject({ code: "invalid" });
  });

  it("rechecks deactivation before allowing a category change", async () => {
    const banned = await addUser(db, { banned: true });
    await expect(createCategory(db, banned, { name: "Forbidden" })).rejects.toMatchObject({ code: "not-signed-in" });
  });

  it("requires a live category before creating any item, Stock or History", async () => {
    const before = await db.$count(item);
    await expect(createInventoryItem(db, admin, { name: "Missing category" })).rejects.toMatchObject({ code: "invalid" });
    const place = await createLocation(db, admin, { name: "Category validation" });
    for (const categoryId of [undefined, "", "not-a-category", crypto.randomUUID()]) {
      await expect(createInventoryItem(db, admin, {
        name: "Invalid category item", categoryId,
        startingStock: { locationId: place.id, count: 2 },
      })).rejects.toMatchObject({ code: "invalid" });
    }
    expect(await db.$count(item)).toBe(before);
  });

  it("keeps Gifts independent of Categories", async () => {
    const gift = await createGift(db, admin, { name: "Category-free Gift" });
    expect((await loadGiftScreen(db, gift.id))?.item.categoryId).toBeNull();
    await expect(db.update(item).set({ categoryId: testCategoryId }).where(eq(item.id, gift.id))).rejects.toThrow();
  });

  it("renames categories on item details and reassigns them without changing Stock or History", async () => {
    const original = await createCategory(db, admin, { name: "Original" });
    const target = await createCategory(db, admin, { name: "Replacement" });
    const place = await createLocation(db, admin, { name: "Reassignment Stock" });
    const created = await createInventoryItem(db, admin, {
      name: "Reassigned item", categoryId: original.id,
      startingStock: { locationId: place.id, count: 7 },
    });
    const before = await loadItemScreen(db, created.id);
    await renameCategory(db, admin, { categoryId: original.id, name: "Renamed" });
    expect((await loadItemScreen(db, created.id))?.item.categoryName).toBe("Renamed");
    await editInventoryItem(db, admin, { id: created.id, name: "Reassigned item", categoryId: target.id });
    const after = await loadItemScreen(db, created.id);
    expect(after?.item).toMatchObject({ categoryId: target.id, categoryName: target.name });
    expect(after?.location).toEqual(before?.location);
    expect(after?.history).toEqual(before?.history);
    await expect(editInventoryItem(db, admin, { id: created.id, name: "Bad edit", categoryId: crypto.randomUUID() })).rejects.toMatchObject({ code: "invalid" });
    expect((await loadItemScreen(db, created.id))?.item.name).toBe("Reassigned item");
    await expect(editInventoryItem(db, admin, { id: created.id, name: "Missing category" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("deletion leaves live and Archived items Unassigned and preserves their Stock and History", async () => {
    const c = await createCategory(db, admin, { name: "To delete" });
    const place = await createLocation(db, admin, { name: "Preserved Stock" });
    const live = await createInventoryItem(db, admin, { name: "Orphaned item", categoryId: c.id, startingStock: { locationId: place.id, count: 4 } });
    const archived = await createInventoryItem(db, admin, { name: "Archived category item", categoryId: c.id });
    await db.update(item).set({ archivedAt: new Date() }).where(eq(item.id, archived.id));
    expect((await loadCategoriesScreen(db)).categories.find((row) => row.id === c.id)?.items).toBe(2);
    const before = await loadItemScreen(db, live.id);
    await deleteCategory(db, admin, { id: c.id });
    for (const id of [live.id, archived.id]) expect((await loadItemScreen(db, id))?.item.categoryId).toBeNull();
    const after = await loadItemScreen(db, live.id);
    expect(after?.location).toEqual(before?.location);
    expect(after?.history).toEqual(before?.history);
    expect((await loadInventoryScreen(db, { categoryId: "unassigned" })).items.map((i) => i.id)).toContain(live.id);
    expect((await loadInventoryScreen(db, { categoryId: "unassigned", archived: true })).items.map((i) => i.id)).toContain(archived.id);
    await expect(createInventoryItem(db, admin, { name: "Stale category", categoryId: c.id })).rejects.toMatchObject({ code: "invalid" });
  });

  it("combines Category, Location, Available and Archived filters within the query budget", async () => {
    const c = await createCategory(db, admin, { name: "Filtered" });
    const place = await createLocation(db, admin, { name: "Filtered Stock" });
    const otherPlace = await createLocation(db, admin, { name: "Other Stock" });
    const stock = { locationId: place.id, count: 3 };
    const matching = await createInventoryItem(db, admin, { name: "Matching category", categoryId: c.id, startingStock: stock });
    await createInventoryItem(db, admin, { name: "Wrong category", categoryId: testCategoryId, startingStock: stock });
    await createInventoryItem(db, admin, { name: "Wrong location", categoryId: c.id, startingStock: { locationId: otherPlace.id, count: 3 } });
    const archived = await createInventoryItem(db, admin, { name: "Archived match", categoryId: c.id, startingStock: stock });
    await db.update(item).set({ archivedAt: new Date() }).where(eq(item.id, archived.id));
    const filters = { categoryId: c.id, locationId: place.id, availableFrom: "2099-05-10", availableTo: "2099-05-12" };
    expect((await loadInventoryScreen(db, filters)).items.map((i) => i.id)).toEqual([matching.id]);
    expect((await loadInventoryScreen(db, { ...filters, archived: true })).items.map((i) => i.id)).toEqual([archived.id]);
    expect(await countRoundTrips(db, () => loadInventoryScreen(db, filters))).toBeLessThanOrEqual(2);
    expect((await loadInventoryScreen(db, { categoryId: "invalid" })).items.map((i) => i.id)).toContain(matching.id);
  });

  it("counts categories in one round trip, including categories with no items", async () => {
    const c = await createCategory(db, admin, { name: "Empty category" });
    expect((await loadCategoriesScreen(db)).categories.find((row) => row.id === c.id)?.items).toBe(0);
    expect(await countRoundTrips(db, () => loadCategoriesScreen(db))).toBeLessThanOrEqual(1);
    expect(await db.$count(category)).toBeGreaterThan(0);
  });
});
