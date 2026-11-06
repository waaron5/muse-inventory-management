import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { event, line, location } from "@/db/schema";
import { testCategoryId, addUser, countRoundTrips, testDb } from "@/test/db";
import { acknowledgeShortage } from "../commands/acknowledge-shortage";
import { createEvent } from "../commands/create-event";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import { addPastUsePhoto } from "../commands/photos";
import { reserve } from "../commands/reserve";
import { loadCatalogItem, loadGiftScreen, loadItemScreen } from "./item";

describe("loadItemScreen", () => {
  it("finds nothing for an id that isn't an item", async () => {
    const db = await testDb();

    expect(await loadItemScreen(db, crypto.randomUUID())).toBeNull();
    expect(await loadItemScreen(db, "chalkboard")).toBeNull();
  });

  it("never shows a Gift as an Inventory Item, nor an Inventory Item as a Gift", async () => {
    const db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });
    const jacket = await createGift(db, admin, { name: "Nano Puff jacket – M" });

    expect(await loadItemScreen(db, jacket.id)).toBeNull();
    expect(await loadGiftScreen(db, chair.id)).toBeNull();
    expect((await loadGiftScreen(db, jacket.id))?.item.name).toBe("Nano Puff jacket – M");
  });

  it("loads either kind for an AI Connection, saying which, within 2 sequential round trips", async () => {
    const db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });
    const jacket = await createGift(db, admin, { name: "Nano Puff jacket – M" });

    expect(await loadCatalogItem(db, chair.id)).toMatchObject({ item: { kind: "inventory", categoryName: "Furniture" } });
    expect(await loadCatalogItem(db, jacket.id)).toMatchObject({ item: { kind: "gift" }, categories: [] });
    expect(await countRoundTrips(db, () => loadCatalogItem(db, jacket.id))).toBeLessThanOrEqual(2);
  });

  it("lists the Locations an item can move to, never Unassigned", async () => {
    const db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    const garage = await createLocation(db, admin, { name: "Garage" });
    const [unit] = await db.insert(location).values({ name: "Old unit" }).returning();
    const { id } = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });

    const screen = await loadItemScreen(db, id);

    expect(screen?.locations).toEqual([
      { id: garage.id, name: "Garage" },
      { id: unit.id, name: "Old unit" },
      { id: warehouse.id, name: "Warehouse" },
    ]);
  });

  it("stays within 2 sequential round trips", async () => {
    const db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    const { id } = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Folding chair",
      startingStock: { locationId: warehouse.id, count: 18 },
    });

    const trips = await countRoundTrips(db, () => loadItemScreen(db, id));

    expect(trips).toBeLessThanOrEqual(2);
  });

  describe("Events", () => {
    const now = new Date("2026-11-01T12:00:00-06:00");

    it("lists the Upcoming events holding an Inventory Item, soonest first", async () => {
      const db = await testDb();
      const actor = await addUser(db, { role: "admin" });
      const chair = await createInventoryItem(db, actor, { categoryId: testCategoryId, name: "Folding chair" });
      const plan = (name: string, startsOn: string, endsOn?: string) =>
        createEvent(db, actor, { name, client: { name: "Acme" }, startsOn, endsOn });
      const over = await plan("Over", "2026-10-20", "2026-10-22");
      const today = await plan("Ends today", "2026-10-30", "2026-11-01");
      const later = await plan("Later", "2026-12-01");
      const cancelled = await plan("Fell through", "2026-11-20");
      for (const e of [over, today, later, cancelled]) {
        await reserve(db, actor, { eventId: e.id, itemId: chair.id, count: 2 });
      }
      await db.update(event).set({ cancelledAt: new Date() }).where(eq(event.id, cancelled.id));

      const screen = await loadItemScreen(db, chair.id, now);

      expect(screen?.upcoming).toMatchObject([
        { event: { id: today.id, name: "Ends today" }, reserved: 2 },
        { event: { id: later.id, name: "Later" }, reserved: 2 },
      ]);
    });

    it("flags each Upcoming event's Shortage of the item until it's acknowledged", async () => {
      const db = await testDb();
      const admin = await addUser(db, { role: "admin" });
      const warehouse = await createLocation(db, admin, { name: "Warehouse" });
      const tent = await createInventoryItem(db, admin, {
        categoryId: testCategoryId,
        name: "Tent",
        startingStock: { locationId: warehouse.id, count: 4 },
      });
      // Far enough ahead that the days are still to come whenever this runs.
      const plan = (name: string, startsOn: string) =>
        createEvent(db, admin, { name, client: { name: "Acme" }, startsOn });
      const short = await plan("Short", "2031-05-01");
      const rival = await plan("Rival", "2031-05-01");
      const acked = await plan("Acked", "2031-06-01");
      const ackedRival = await plan("Acked rival", "2031-06-01");
      const fine = await plan("Fine", "2031-07-01");
      await reserve(db, admin, { eventId: short.id, itemId: tent.id, count: 3 });
      await reserve(db, admin, { eventId: rival.id, itemId: tent.id, count: 2 });
      await reserve(db, admin, { eventId: acked.id, itemId: tent.id, count: 3 });
      await reserve(db, admin, { eventId: ackedRival.id, itemId: tent.id, count: 3 });
      await reserve(db, admin, { eventId: fine.id, itemId: tent.id, count: 4 });
      await acknowledgeShortage(db, admin, { eventId: acked.id, itemId: tent.id, note: "Borrowing two", shortBy: 2 });

      const screen = await loadItemScreen(db, tent.id, now);

      expect(screen?.upcoming.map((u) => [u.event.name, u.shortBy])).toEqual([
        ["Rival", 1],
        ["Short", 1],
        ["Acked", null],
        ["Acked rival", null],
        ["Fine", null],
      ]);
    });

    it("lists a Gift's holders until it's Given Away, whatever the dates", async () => {
      const db = await testDb();
      const actor = await addUser(db, { role: "admin" });
      const jacket = await createGift(db, actor, { name: "Nano Puff jacket – M" });
      const longAgo = await createEvent(db, actor, { name: "Long ago", client: { name: "Acme" }, startsOn: "2025-06-01" });
      const done = await createEvent(db, actor, { name: "Done", client: { name: "Acme" }, startsOn: "2025-07-01" });
      await reserve(db, actor, { eventId: longAgo.id, itemId: jacket.id, count: 5 });
      const given = await reserve(db, actor, { eventId: done.id, itemId: jacket.id, count: 5 });
      await db.update(line).set({ givenAwayAt: new Date() }).where(eq(line.id, given.id));

      const screen = await loadGiftScreen(db, jacket.id, now);

      expect(screen?.upcoming.map((u) => u.event.name)).toEqual(["Long ago"]);
    });

    it("offers the Upcoming Events it can be reserved for, with what's Available for each", async () => {
      const db = await testDb();
      const actor = await addUser(db, { role: "admin" });
      const warehouse = await createLocation(db, actor, { name: "Warehouse" });
      const tent = await createInventoryItem(db, actor, {
        categoryId: testCategoryId,
        name: "Tent",
        startingStock: { locationId: warehouse.id, count: 5 },
      });
      const plan = (name: string, startsOn?: string) =>
        createEvent(db, actor, { name, client: { name: "Acme" }, startsOn });
      await plan("Over", "2026-10-01");
      const busy = await plan("Busy", "2026-11-10");
      const same = await plan("Same day", "2026-11-10");
      await plan("Someday");
      await reserve(db, actor, { eventId: busy.id, itemId: tent.id, count: 2 });

      const screen = await loadItemScreen(db, tent.id, now);

      expect(screen?.reserveFor).toEqual([
        expect.objectContaining({ id: busy.id, name: "Busy", available: 5 }),
        expect.objectContaining({ id: same.id, name: "Same day", available: 3 }),
      ]);
    });

    it("offers a Gift to Upcoming Events without dates too", async () => {
      const db = await testDb();
      const actor = await addUser(db, { role: "admin" });
      const jacket = await createGift(db, actor, { name: "Nano Puff jacket – M" });
      await createEvent(db, actor, { name: "Someday", client: { name: "Acme" } });

      const screen = await loadGiftScreen(db, jacket.id, now);

      expect(screen?.reserveFor).toEqual([expect.objectContaining({ name: "Someday", available: 0 })]);
    });
  });

  describe("Past-use photos", () => {
    it("offers only the Events the item went to, most recent first", async () => {
      const db = await testDb();
      const admin = await addUser(db, { role: "admin" });
      const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });
      const banner = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Banner" });
      const plan = (name: string, startsOn: string) =>
        createEvent(db, admin, { name, client: { name: "Acme" }, startsOn, endsOn: startsOn });
      const reserved = async (name: string, startsOn: string, itemId = chair.id) => {
        const found = await plan(name, startsOn);
        await reserve(db, admin, { eventId: found.id, itemId, count: 2 });
        return found;
      };
      await reserved("Spring fair", "2026-04-01");
      await reserved("Gala", "2026-06-10");
      // Still to come, another item's, and one that fell through.
      await reserved("Picnic", "2030-07-01");
      await reserved("Expo", "2026-08-01", banner.id);
      const fellThrough = await reserved("Fell through", "2026-09-01");
      await db.update(event).set({ cancelledAt: new Date() }).where(eq(event.id, fellThrough.id));

      const screen = await loadItemScreen(db, chair.id, new Date("2026-10-27T12:00:00-06:00"));

      expect(screen?.wentTo.map((e) => e.name)).toEqual(["Gala", "Spring fair"]);
    });

    it("shows the newest photo first", async () => {
      const db = await testDb();
      const someone = await addUser(db, { name: "Bea" });
      const admin = await addUser(db, { role: "admin" });
      const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });
      const first = crypto.randomUUID();
      const second = crypto.randomUUID();
      await addPastUsePhoto(db, someone, { itemId: chair.id, photo: first });
      await addPastUsePhoto(db, someone, { itemId: chair.id, photo: second, note: "Later" });

      const screen = await loadItemScreen(db, chair.id);

      expect(screen?.pastUses.map((p) => p.photo)).toEqual([second, first]);
    });

    it("stays within 2 sequential round trips with photos", async () => {
      const db = await testDb();
      const admin = await addUser(db, { role: "admin" });
      const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });
      await addPastUsePhoto(db, admin, { itemId: chair.id, photo: crypto.randomUUID() });

      const trips = await countRoundTrips(db, () => loadItemScreen(db, chair.id));

      expect(trips).toBeLessThanOrEqual(2);
    });
  });
});
