import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, countRoundTrips, testDb } from "@/test/db";
import { adjustStock } from "../commands/adjust-stock";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createEvent } from "../commands/create-event";
import { createLocation } from "../commands/create-location";
import { reserve } from "../commands/reserve";
import { loadGiftsScreen } from "./gifts";

describe("loadGiftsScreen", () => {
  let db: Db;
  let warehouse: { id: string };
  beforeAll(async () => {
    db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    warehouse = await createLocation(db, admin, { name: "Warehouse" });
    await createLocation(db, admin, { name: "Garage" });
    await createGift(db, admin, {
      name: "Nano Puff jacket – M",
      sku: "NP-M",
      startingStock: { locationId: warehouse.id, count: 12 },
    });
    const tote = await createGift(db, admin, {
      name: "Canvas tote",
      startingStock: { locationId: warehouse.id, count: 3 },
    });
    await adjustStock(db, admin, {
      itemId: tote.id,
      reason: "lost",
      count: 3,
    });
    const bottle = await createGift(db, admin, { name: "Water bottle", startingStock: { locationId: warehouse.id, count: 40 } });
    const gala = await createEvent(db, admin, { name: "Gala", client: { name: "Acme" }, startsOn: "2099-11-10", endsOn: "2099-11-10" });
    await reserve(db, admin, { eventId: gala.id, itemId: bottle.id, count: 30 });
    await reserve(db, admin, { eventId: gala.id, itemId: tote.id, count: 5 });
    await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Folding chair",
      startingStock: { locationId: warehouse.id, count: 18 },
    });
  });

  it("lists only Gifts, those with none left after the rest", async () => {
    const { items } = await loadGiftsScreen(db, {});

    expect(items).toEqual([
      expect.objectContaining({ name: "Nano Puff jacket – M", sku: "NP-M", count: 12 }),
      expect.objectContaining({ name: "Water bottle", count: 40 }),
      expect.objectContaining({ name: "Canvas tote", count: 0 }),
    ]);
  });

  it("totals what Events hold of each Gift, and flags any held beyond its Count", async () => {
    const { items } = await loadGiftsScreen(db, {});

    expect(items.map((i) => [i.name, i.held, i.shortBy, i.next])).toEqual([
      ["Nano Puff jacket – M", 0, null, null],
      ["Water bottle", 30, null, null],
      ["Canvas tote", 5, 5, null],
    ]);
  });

  it("narrows to Gifts at a Location as the Inventory list does", async () => {
    expect((await loadGiftsScreen(db, { locationId: warehouse.id })).items.map((i) => i.name)).toEqual([
      "Nano Puff jacket – M",
      "Water bottle",
      "Canvas tote",
    ]);
  });

  it("lists the Locations for the filter", async () => {
    const { locations } = await loadGiftsScreen(db, {});

    expect(locations.map((l) => l.name)).toEqual(["Garage", "Warehouse"]);
  });

  it("stays within 2 sequential round trips", async () => {
    expect(await countRoundTrips(db, () => loadGiftsScreen(db, { locationId: warehouse.id }))).toBeLessThanOrEqual(2);
  });
});
