import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { addUser, countRoundTrips, testCategoryId, testDb } from "@/test/db";
import { archiveItem } from "../commands/archive-item";
import { createCategory } from "../commands/categories";
import { createEvent } from "../commands/create-event";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import { reserve } from "../commands/reserve";
import { loadAiAvailability } from "./ai-availability";
import { loadEventScreen } from "./event";
import { loadGiftsScreen } from "./gifts";
import { loadInventoryScreen } from "./inventory";

describe("loadAiAvailability", () => {
  let db: Db;
  let chairs: { id: string };
  let tables: { id: string };
  let oldChairs: { id: string };
  let totes: { id: string };
  let cove: { id: string };
  let undated: { id: string };
  let seating: string;

  beforeAll(async () => {
    db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    ({ id: seating } = await createCategory(db, admin, { name: "Seating" }));
    const stocked = (name: string, count: number, categoryId = seating) =>
      createInventoryItem(db, admin, { categoryId, name, startingStock: { locationId: warehouse.id, count } });
    chairs = await stocked("Folding chair", 10);
    tables = await stocked("Cocktail table", 4, testCategoryId);
    // Archived only once none are left.
    oldChairs = await createInventoryItem(db, admin, { categoryId: seating, name: "Oak chair" });
    await archiveItem(db, admin, { id: oldChairs.id });
    totes = await createGift(db, admin, { name: "Tote", startingStock: { locationId: warehouse.id, count: 20 } });

    const plan = (name: string, startsOn?: string, endsOn?: string) =>
      createEvent(db, admin, { name, client: { name: "Birchline" }, startsOn, endsOn });
    const before = await plan("Before", "2027-05-01", "2027-05-03");
    const after = await plan("After", "2027-05-05", "2027-05-07");
    cove = await plan("Cove", "2027-05-03", "2027-05-05");
    undated = await plan("Someday");
    await reserve(db, admin, { eventId: before.id, itemId: chairs.id, count: 4 });
    await reserve(db, admin, { eventId: after.id, itemId: chairs.id, count: 5 });
    await reserve(db, admin, { eventId: cove.id, itemId: chairs.id, count: 3 });
    await reserve(db, admin, { eventId: before.id, itemId: tables.id, count: 4 });
    await reserve(db, admin, { eventId: cove.id, itemId: tables.id, count: 1 });
    await reserve(db, admin, { eventId: undated.id, itemId: totes.id, count: 15 });
    await reserve(db, admin, { eventId: cove.id, itemId: totes.id, count: 8 });
  });

  const found = (answer: Awaited<ReturnType<typeof loadAiAvailability>>, id: string) =>
    answer && "items" in answer ? answer.items.find((i) => i.id === id) : undefined;

  it("over given dates, matches the Inventory list's Available across those days", async () => {
    const answer = await loadAiAvailability(db, { itemIds: [chairs.id, tables.id], from: "2027-05-02", to: "2027-05-05" });
    const screen = await loadInventoryScreen(db, { availableFrom: "2027-05-02", availableTo: "2027-05-05" });

    expect(found(answer, chairs.id)?.available).toBe(screen.items.find((i) => i.id === chairs.id)?.available);
    expect(found(answer, chairs.id)).toMatchObject({ available: 2, shortBy: null });
    // Every table is out on the 2nd and 3rd, which the screen leaves off its list.
    expect(found(answer, tables.id)).toMatchObject({ available: -1, shortBy: 1 });
  });

  it("counts a Shortage over given dates from today on, as the app flags them", async () => {
    const answer = await loadAiAvailability(db, { itemIds: [tables.id], from: "2027-05-02", to: "2027-05-05" }, new Date("2027-05-04T18:00:00Z"));

    // Short on the 3rd, which has gone; free again from the 4th.
    expect(found(answer, tables.id)).toMatchObject({ available: -1, shortBy: null });
  });

  it("over an Event's Hold Window, matches what its page offers to reserve and its Shortages", async () => {
    const answer = await loadAiAvailability(db, { itemIds: [chairs.id, tables.id, totes.id], eventId: cove.id });
    const screen = (await loadEventScreen(db, cove.id))!;
    const offered = [...screen.reservable.inventory, ...screen.reservable.gifts];

    for (const id of [chairs.id, tables.id, totes.id]) {
      expect(found(answer, id)?.available).toBe(offered.find((i) => i.id === id)?.available);
    }
    expect(found(answer, chairs.id)).toMatchObject({ available: 5, reservedForEvent: 3, shortage: null });
    expect(found(answer, tables.id)).toMatchObject({
      available: 0,
      reservedForEvent: 1,
      shortage: { shortBy: 1, flagged: true, competing: [{ event: { name: "Before" }, reserved: 4 }] },
    });
    expect((found(answer, tables.id) as { shortage: { shortBy: number } }).shortage.shortBy).toBe(screen.shortages.find((s) => s.item.id === tables.id)?.shortBy);
    expect(answer).toMatchObject({ over: { event: { name: "Cove" }, from: "2027-05-03", to: "2027-05-05" } });
  });

  it("takes a Gift's Available as its Count less every other hold not yet Given Away, as the Gifts list does", async () => {
    const answer = await loadAiAvailability(db, { itemIds: [totes.id], from: "2027-01-01", to: "2027-01-01" });
    const gifts = await loadGiftsScreen(db, {});

    expect(found(answer, totes.id)).toMatchObject({ kind: "gift", count: 20, available: -3, shortBy: 3 });
    expect(gifts.items.find((g) => g.id === totes.id)?.held).toBe(23);
  });

  it("has no Available for Inventory Items over an Event without dates, but does for Gifts", async () => {
    const answer = await loadAiAvailability(db, { itemIds: [chairs.id, totes.id], eventId: undated.id });

    expect(found(answer, chairs.id)).toMatchObject({ available: null });
    expect(found(answer, totes.id)).toMatchObject({ available: 12, reservedForEvent: 15 });
  });

  it("lists a Category's Inventory Items, leaving Archived ones out unless asked for", async () => {
    const window = { from: "2027-05-02", to: "2027-05-05" };
    const listed = await loadAiAvailability(db, { categoryId: seating, ...window });
    const withArchived = await loadAiAvailability(db, { categoryId: seating, archived: true, ...window });

    expect(listed && "items" in listed && listed.items.map((i) => i.name)).toEqual(["Folding chair"]);
    expect(withArchived && "items" in withArchived && withArchived.items.map((i) => i.name)).toEqual(["Folding chair", "Oak chair"]);
  });

  it("keeps an Archived item asked for by id, saying it's Archived", async () => {
    const answer = await loadAiAvailability(db, { itemIds: [oldChairs.id], from: "2027-05-02" });

    expect(found(answer, oldChairs.id)).toMatchObject({ archived: true, count: 0, available: 0 });
  });

  it("finds no Event that isn't there", async () => {
    expect(await loadAiAvailability(db, { itemIds: [chairs.id], eventId: "00000000-0000-4000-8000-000000000000" })).toBeNull();
  });

  it("stays within 2 sequential round trips", async () => {
    expect(await countRoundTrips(db, () => loadAiAvailability(db, { itemIds: [chairs.id], eventId: cove.id }))).toBeLessThanOrEqual(2);
    expect(await countRoundTrips(db, () => loadAiAvailability(db, { categoryId: seating, from: "2027-05-02" }))).toBeLessThanOrEqual(1);
  });
});
