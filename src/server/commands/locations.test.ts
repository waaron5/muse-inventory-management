import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { loadItemScreen } from "../loaders/item";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { renameLocation } from "./locations";

let db: Db;
let admin: Awaited<ReturnType<typeof addUser>>;
let someone: Awaited<ReturnType<typeof addUser>>;
let warehouse: { id: string };
beforeAll(async () => {
  db = await testDb();
  admin = await addUser(db, { role: "admin" });
  someone = await addUser(db, { role: "user" });
  warehouse = await createLocation(db, admin, { name: "Warehouse" });
});

describe("renameLocation", () => {
  it("renames a Location wherever it shows", async () => {
    const shed = await createLocation(db, admin, { name: "Shed" });
    const chairs = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Chair", startingStock: { locationId: shed.id, count: 3 } });

    await renameLocation(db, admin, { locationId: shed.id, name: "  Back shed " });

    expect((await loadItemScreen(db, chairs.id))!.location).toEqual({ id: shed.id, name: "Back shed" });
  });

  it("refuses an empty name", async () => {
    await expect(renameLocation(db, admin, { locationId: warehouse.id, name: "  " })).rejects.toMatchObject({
      code: "invalid",
      message: "Give the Location a name.",
    });
  });

  it("is an Admin's to do", async () => {
    await expect(renameLocation(db, someone, { locationId: warehouse.id, name: "Mine" })).rejects.toMatchObject({
      code: "not-allowed",
    });
  });
});
