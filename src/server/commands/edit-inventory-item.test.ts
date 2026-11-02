import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { loadItemScreen } from "../loaders/item";
import { createInventoryItem } from "./create-inventory-item";
import { editInventoryItem } from "./edit-inventory-item";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("editInventoryItem", () => {
  it("lets an Admin change the name, SKU, Unit Price and Description", async () => {
    const admin = await addUser(db, { role: "admin" });
    const { id } = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Chalkbord", sku: "CB-1", unitPrice: "40" });

    await editInventoryItem(db, admin, {
      categoryId: testCategoryId,
      id,
      name: "Chalkboard",
      sku: "",
      unitPrice: "45.50",
      description: "A-frame, two sided.",
    });

    const screen = await loadItemScreen(db, id);
    expect(screen?.item).toMatchObject({
      name: "Chalkboard",
      sku: null,
      unitPriceCents: 4550,
      description: "A-frame, two sided.",
    });
  });

  it("refuses a User and changes nothing", async () => {
    const admin = await addUser(db, { role: "admin" });
    const someone = await addUser(db, { role: "user" });
    const { id } = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Banner" });

    await expect(editInventoryItem(db, someone, { categoryId: testCategoryId, id, name: "Renamed banner" })).rejects.toMatchObject({
      code: "not-allowed",
    });
    expect((await loadItemScreen(db, id))?.item.name).toBe("Banner");
  });

  it("refuses an item that doesn't exist", async () => {
    const admin = await addUser(db, { role: "admin" });

    await expect(
      editInventoryItem(db, admin, { categoryId: testCategoryId, id: crypto.randomUUID(), name: "Nothing" }),
    ).rejects.toMatchObject({ code: "invalid", message: "That item no longer exists." });
  });
});
