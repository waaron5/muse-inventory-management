import { describe, expect, it } from "vitest";
import { testCategoryId, addUser, countRoundTrips, testDb } from "@/test/db";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import { loadLocationsScreen } from "./locations";

describe("loadLocationsScreen", () => {
  it("lists every Location by name with how much it holds", async () => {
    const db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    const garage = await createLocation(db, admin, { name: "garage" });
    const old = await createLocation(db, admin, { name: "Old unit" });
    await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Chair", startingStock: { locationId: warehouse.id, count: 12 } });
    await createGift(db, admin, { name: "Mug", startingStock: { locationId: warehouse.id, count: 30 } });

    const { locations } = await loadLocationsScreen(db);

    expect(locations).toEqual([
      { id: garage.id, name: "garage", holds: 0 },
      { id: old.id, name: "Old unit", holds: 0 },
      { id: warehouse.id, name: "Warehouse", holds: 42 },
    ]);
  });

  it("stays within 2 sequential round trips", async () => {
    const db = await testDb();

    expect(await countRoundTrips(db, () => loadLocationsScreen(db))).toBeLessThanOrEqual(2);
  });
});
