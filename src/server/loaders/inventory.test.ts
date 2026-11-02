import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { item, location } from "@/db/schema";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, countRoundTrips, testDb } from "@/test/db";
import { cancelEvent } from "../commands/cancel-event";
import { createEvent } from "../commands/create-event";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import { setItemPhoto } from "../commands/photos";
import { reserve } from "../commands/reserve";
import { loadInventoryScreen } from "./inventory";

describe("loadInventoryScreen", () => {
  it("lists all Locations by name", async () => {
    const db = await testDb();
    await db.insert(location).values([
      { name: "Warehouse" },
      { name: "Garage" },
      { name: "Old unit" },
    ]);

    const { locations } = await loadInventoryScreen(db, {});

    expect(locations.map((l) => l.name)).toEqual(["Garage", "Old unit", "Warehouse"]);
  });

  describe("items", () => {
    let db: Db;
    let warehouse: { id: string };
    let garage: { id: string };
    const chairPhoto = crypto.randomUUID();
    beforeAll(async () => {
      db = await testDb();
      const admin = await addUser(db, { role: "admin" });
      warehouse = await createLocation(db, admin, { name: "Warehouse" });
      garage = await createLocation(db, admin, { name: "Garage" });
      const chair = await createInventoryItem(db, admin, {
        categoryId: testCategoryId,
        name: "Folding chair",
        sku: "FC-20",
        unitPrice: "12",
        startingStock: { locationId: garage.id, count: 24 },
      });
      await setItemPhoto(db, admin, { itemId: chair.id, photo: chairPhoto });
      const chalkboard = await createInventoryItem(db, admin, {
        categoryId: testCategoryId,
        name: "Chalkboard",
        description: "A-frame, wipe-clean",
        startingStock: { locationId: warehouse.id, count: 4 },
      });
      await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Cornhole set", sku: "CH-01" });
      const gala = await createEvent(db, admin, {
        name: "Gala",
        client: { name: "Acme" },
        startsOn: "2099-11-10",
        endsOn: "2099-11-12",
      });
      await reserve(db, admin, { eventId: gala.id, itemId: chair.id, count: 2 });
      const fellThrough = await createEvent(db, admin, {
        name: "Picnic",
        client: { name: "Acme" },
        startsOn: "2099-11-10",
        endsOn: "2099-11-10",
      });
      await reserve(db, admin, { eventId: fellThrough.id, itemId: chalkboard.id, count: 1 });
      await cancelEvent(db, admin, { id: fellThrough.id });
      const { id } = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Retired banner" });
      await db.update(item).set({ archivedAt: new Date() }).where(eq(item.id, id));
      await createGift(db, admin, {
        name: "Chalkboard tote",
        sku: "CH-02",
        startingStock: { locationId: garage.id, count: 30 },
      });
    });

    it("never lists a Gift", async () => {
      const lists = await Promise.all([
        loadInventoryScreen(db, {}),
        loadInventoryScreen(db, { locationId: garage.id }),
      ]);

      expect(lists.flatMap((l) => l.items.map((i) => i.name))).not.toContain("Chalkboard tote");
    });

    it("lists live items by name with their Count", async () => {
      const { items } = await loadInventoryScreen(db, {});

      expect(items).toEqual([
        expect.objectContaining({ name: "Chalkboard", sku: null, count: 4 }),
        expect.objectContaining({ name: "Cornhole set", count: 0 }),
        expect.objectContaining({
          name: "Folding chair",
          sku: "FC-20",
          unitPriceCents: 1200,
          count: 24,
        }),
      ]);
    });

    it("shows each item's Item Photo, or none", async () => {
      const { items } = await loadInventoryScreen(db, {});

      expect(items.map((i) => i.photo)).toEqual([null, null, chairPhoto]);
    });

    it("shows each item's Description and its one Location", async () => {
      const { items } = await loadInventoryScreen(db, {});

      expect(items.map((i) => [i.description, i.location])).toEqual([
        ["A-frame, wipe-clean", "Warehouse"],
        [null, "Unassigned"],
        [null, "Garage"],
      ]);
    });

    it("says which items an Event still holds, so they can't be Archived yet", async () => {
      const { items } = await loadInventoryScreen(db, {});

      // A Cancelled Event holds nothing.
      expect(items.map((i) => [i.name, i.reserved])).toEqual([
        ["Chalkboard", false],
        ["Cornhole set", false],
        ["Folding chair", true],
      ]);
    });

    it("shows each Inventory Item's next hold from today, and no Gift total", async () => {
      const { items } = await loadInventoryScreen(db, {});

      // A Cancelled Event holds nothing.
      expect(items.map((i) => [i.name, i.next, i.held, i.shortBy])).toEqual([
        ["Chalkboard", null, null, null],
        ["Cornhole set", null, null, null],
        ["Folding chair", { reserved: 2, from: "2099-11-10" }, null, null],
      ]);
    });

    it("narrows to items at a Location", async () => {
      const { items } = await loadInventoryScreen(db, { locationId: garage.id });

      expect(items).toEqual([expect.objectContaining({ name: "Folding chair", count: 24 })]);
    });

    it("ignores a Location filter that isn't a Location", async () => {
      const { items } = await loadInventoryScreen(db, { locationId: "not-a-location" });

      expect(items).toHaveLength(3);
    });

    it("stays within 2 sequential round trips, filters and all", async () => {
      const trips = await countRoundTrips(db, () =>
        loadInventoryScreen(db, { locationId: warehouse.id, availableFrom: "2026-11-10" }),
      );

      expect(trips).toBeLessThanOrEqual(2);
    });

    it("shows Archived items only when asked", async () => {
      const { items } = await loadInventoryScreen(db, { archived: true });

      expect(items.map((i) => i.name)).toEqual(["Retired banner"]);
    });
  });

  describe("available for these dates", () => {
    let db: Db;
    beforeAll(async () => {
      db = await testDb();
      const admin = await addUser(db, { role: "admin" });
      const warehouse = await createLocation(db, admin, { name: "Warehouse" });
      const stocked = (name: string, count: number) =>
        createInventoryItem(db, admin, { categoryId: testCategoryId, name, startingStock: { locationId: warehouse.id, count } });
      const chairs = await stocked("Folding chair", 10);
      const tents = await stocked("Tent", 2);
      await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Cornhole set" });
      const gala = await createEvent(db, admin, {
        name: "Gala",
        client: { name: "Acme" },
        startsOn: "2026-11-10",
        endsOn: "2026-11-12",
      });
      await reserve(db, admin, { eventId: gala.id, itemId: chairs.id, count: 4 });
      await reserve(db, admin, { eventId: gala.id, itemId: tents.id, count: 2 });
    });

    it("lists only what's Available across the dates, with how many", async () => {
      const { items } = await loadInventoryScreen(db, { availableFrom: "2026-11-12", availableTo: "2026-11-14" });

      expect(items).toEqual([expect.objectContaining({ name: "Folding chair", available: 6 })]);
    });

    it("counts everything when nothing is held across the dates", async () => {
      const { items } = await loadInventoryScreen(db, { availableFrom: "2026-11-13", availableTo: "2026-11-14" });

      expect(items.map((i) => [i.name, i.available])).toEqual([
        ["Folding chair", 10],
        ["Tent", 2],
      ]);
    });

    it("takes one date as that day, and ignores dates that aren't dates", async () => {
      const oneDay = await loadInventoryScreen(db, { availableFrom: "2026-11-11" });
      const nonsense = await loadInventoryScreen(db, { availableFrom: "soon", availableTo: "later" });

      expect(oneDay.items.map((i) => i.available)).toEqual([6]);
      expect(nonsense.items.map((i) => i.available)).toEqual([null, null, null]);
    });

    it("flags an item its Events hold more of than its Count", async () => {
      const db = await testDb();
      const admin = await addUser(db, { role: "admin" });
      const warehouse = await createLocation(db, admin, { name: "Warehouse" });
      const tents = await createInventoryItem(db, admin, {
        categoryId: testCategoryId,
        name: "Tent",
        startingStock: { locationId: warehouse.id, count: 2 },
      });
      for (const [name, startsOn, count] of [["Fair", "2099-06-01", 3], ["Expo", "2099-07-01", 1]] as const) {
        const { id } = await createEvent(db, admin, { name, client: { name: "Acme" }, startsOn, endsOn: startsOn });
        await reserve(db, admin, { eventId: id, itemId: tents.id, count });
      }

      const { items } = await loadInventoryScreen(db, {});

      expect(items.map((i) => [i.next, i.shortBy])).toEqual([[{ reserved: 3, from: "2099-06-01" }, 1]]);
    });

    it("stays within 2 sequential round trips", async () => {
      const trips = await countRoundTrips(db, () =>
        loadInventoryScreen(db, { availableFrom: "2026-11-12", availableTo: "2026-11-14" }),
      );

      expect(trips).toBeLessThanOrEqual(2);
    });
  });
});
