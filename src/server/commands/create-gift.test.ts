import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { loadGiftScreen } from "../loaders/item";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { editGift } from "./edit-inventory-item";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("createGift", () => {
  it("lets an Admin add a Gift with its Starting Stock", async () => {
    const admin = await addUser(db, { role: "admin", name: "Aaron" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });

    const { id } = await createGift(db, admin, {
      name: "Nano Puff jacket – M",
      sku: "NP-M",
      unitPrice: "249",
      startingStock: { locationId: warehouse.id, count: 12 },
    });

    const screen = await loadGiftScreen(db, id);
    expect(screen?.item).toMatchObject({ name: "Nano Puff jacket – M", sku: "NP-M", unitPriceCents: 24900 });
    expect(screen?.count).toBe(12);
    expect(screen?.history).toEqual([
      expect.objectContaining({ kind: "starting-stock", count: 12, to: "Warehouse", by: "Aaron" }),
    ]);
  });

  it("refuses a User", async () => {
    const someone = await addUser(db, { role: "user" });

    await expect(createGift(db, someone, { name: "Tote bag" })).rejects.toMatchObject({
      code: "not-allowed",
      message: "Only an Admin can do this.",
    });
  });
});

describe("editGift", () => {
  it("lets an Admin keep a Gift's details right", async () => {
    const admin = await addUser(db, { role: "admin" });
    const { id } = await createGift(db, admin, { name: "Nano Puff jacket – M" });

    await editGift(db, admin, { id, name: "Nano Puff jacket – Medium", unitPrice: "249" });

    expect((await loadGiftScreen(db, id))?.item).toMatchObject({ name: "Nano Puff jacket – Medium", unitPriceCents: 24900 });
  });

  it("leaves an Inventory Item alone", async () => {
    const admin = await addUser(db, { role: "admin" });
    const { id } = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });

    await expect(editGift(db, admin, { id, name: "Folding chair (gift)" })).rejects.toMatchObject({
      code: "invalid",
      message: "That item no longer exists.",
    });
  });
});
