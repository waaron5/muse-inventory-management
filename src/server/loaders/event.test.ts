import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { event, line } from "@/db/schema";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, countRoundTrips, testDb } from "@/test/db";
import { todayInMuse } from "@/lib/time-zone";
import { acknowledgeShortage } from "../commands/acknowledge-shortage";
import { addBorrowedItem } from "../commands/add-line";
import { createEvent } from "../commands/create-event";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import { giveAwayEnded } from "../commands/give-away";
import { reserve } from "../commands/reserve";
import { deleteUser } from "../commands/users";
import { loadEventScreen } from "./event";

describe("loadEventScreen", () => {
  let db: Db;
  let cove: { id: string };
  beforeAll(async () => {
    db = await testDb();
    const actor = await addUser(db);
    cove = await createEvent(db, actor, { name: "Cove", client: { name: "Birchline" }, startsOn: "2026-11-10" });
  });

  it("wears its Client's colour", async () => {
    expect(await loadEventScreen(db, cove.id)).toMatchObject({
      client: { name: "Birchline", colour: "violet" },
    });
  });

  it("finds nothing for an Event that isn't there", async () => {
    expect(await loadEventScreen(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await loadEventScreen(db, "not-an-event")).toBeNull();
  });

  it("stays within 2 sequential round trips", async () => {
    expect(await countRoundTrips(db, () => loadEventScreen(db, cove.id))).toBeLessThanOrEqual(2);
  });
});

describe("what can be reserved for an Event", () => {
  let db: Db;
  let actor: Awaited<ReturnType<typeof addUser>>;
  let warehouse: { id: string };
  beforeAll(async () => {
    db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    actor = await addUser(db, { role: "user" });
    warehouse = await createLocation(db, admin, { name: "Warehouse" });
    stocked = async (create, name, count) =>
      create(db, admin, { ...(create === createInventoryItem && { categoryId: testCategoryId }), name, startingStock: { locationId: warehouse.id, count } });
  });
  let stocked: (
    create: typeof createInventoryItem | typeof createGift,
    name: string,
    count: number,
  ) => Promise<{ id: string }>;

  const plan = (name: string, startsOn?: string, endsOn?: string) =>
    createEvent(db, actor, { name, client: { name: "Acme" }, startsOn, endsOn });
  const available = async (eventId: string, itemId: string) => {
    const screen = await loadEventScreen(db, eventId);
    return [...screen!.reservable.inventory, ...screen!.reservable.gifts].find((i) => i.id === itemId)?.available;
  };

  it("takes Available on the busiest day of the Hold Window, not the sum of every overlapping hold", async () => {
    const chairs = await stocked(createInventoryItem, "Folding chair", 10);
    const before = await plan("Before", "2026-11-01", "2026-11-03");
    const after = await plan("After", "2026-11-05", "2026-11-07");
    const ours = await plan("Ours", "2026-11-03", "2026-11-05");
    await reserve(db, actor, { eventId: before.id, itemId: chairs.id, count: 4 });
    await reserve(db, actor, { eventId: after.id, itemId: chairs.id, count: 5 });

    expect(await available(ours.id, chairs.id)).toBe(5);
  });

  it("makes two Events sharing a boundary day compete", async () => {
    const tables = await stocked(createInventoryItem, "Cocktail table", 6);
    const earlier = await plan("Earlier", "2026-12-01", "2026-12-03");
    const ours = await plan("Ours", "2026-12-03", "2026-12-04");
    const later = await plan("Later", "2026-12-05", "2026-12-06");
    await reserve(db, actor, { eventId: earlier.id, itemId: tables.id, count: 2 });
    await reserve(db, actor, { eventId: later.id, itemId: tables.id, count: 3 });

    expect(await available(ours.id, tables.id)).toBe(4);
  });

  it("holds over the Event's own dates, an Event with one date set lasting that day", async () => {
    const tents = await stocked(createInventoryItem, "Tent", 3);
    const startOnly = await plan("Starts only", "2027-01-10");
    const endOnly = await plan("Ends only", undefined, "2027-01-11");
    const ours = await plan("Ours", "2027-01-08", "2027-01-12");
    await reserve(db, actor, { eventId: startOnly.id, itemId: tents.id, count: 2 });
    await reserve(db, actor, { eventId: endOnly.id, itemId: tents.id, count: 1 });

    expect(await available(ours.id, tents.id)).toBe(1);
    expect(await available(startOnly.id, tents.id)).toBe(3);
  });

  it("leaves out the Event's own Line and Cancelled Events", async () => {
    const boards = await stocked(createInventoryItem, "Chalkboard", 8);
    const ours = await plan("Ours", "2027-02-01", "2027-02-02");
    const cancelled = await plan("Fell through", "2027-02-01", "2027-02-02");
    await reserve(db, actor, { eventId: ours.id, itemId: boards.id, count: 3 });
    await reserve(db, actor, { eventId: cancelled.id, itemId: boards.id, count: 5 });
    await db.update(event).set({ cancelledAt: new Date() }).where(eq(event.id, cancelled.id));

    expect(await available(ours.id, boards.id)).toBe(8);
  });

  it("goes below none once Events ask for more than the Count, and the over-commitment saves", async () => {
    const surfboards = await stocked(createInventoryItem, "Surfboard", 2);
    const first = await plan("First", "2027-03-01", "2027-03-01");
    const second = await plan("Second", "2027-03-01", "2027-03-01");
    await reserve(db, actor, { eventId: first.id, itemId: surfboards.id, count: 2 });

    await reserve(db, actor, { eventId: second.id, itemId: surfboards.id, count: 3 });

    expect((await loadEventScreen(db, second.id))?.inventory).toMatchObject([{ reserved: 3 }]);
    expect(await available(first.id, surfboards.id)).toBe(-1);
  });

  it("holds a Gift whatever the dates until it's Given Away", async () => {
    const jackets = await stocked(createGift, "Nano Puff jacket – M", 50);
    const longAgo = await plan("Long ago", "2025-06-01", "2025-06-02");
    const done = await plan("Done", "2025-07-01", "2025-07-02");
    const undated = await plan("Someday");
    const ours = await plan("Ours", "2027-04-01", "2027-04-02");
    await reserve(db, actor, { eventId: longAgo.id, itemId: jackets.id, count: 20 });
    await reserve(db, actor, { eventId: undated.id, itemId: jackets.id, count: 5 });
    const given = await reserve(db, actor, { eventId: done.id, itemId: jackets.id, count: 10 });
    // As the giveaway marks it, leaving its Stock alone here.
    await db.update(line).set({ givenAwayAt: new Date() }).where(eq(line.id, given.id));

    expect(await available(ours.id, jackets.id)).toBe(25);
    expect(await available(undated.id, jackets.id)).toBe(30);
  });

  it("offers no Inventory to an Event without dates", async () => {
    const undated = await plan("Someday");

    const screen = await loadEventScreen(db, undated.id);

    expect(screen?.reservable.inventory).toEqual([]);
    expect(screen?.reservable.gifts.map((g) => g.name)).toContain("Nano Puff jacket – M");
  });
});

describe("what an Event's Lines are worth", () => {
  it("totals reserved count × Unit Price, ignoring unpriced Lines", async () => {
    const db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    const gala = await createEvent(db, admin, { name: "Gala", client: { name: "Acme" }, startsOn: "2026-11-10" });
    const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair", unitPrice: "12.50" });
    const jacket = await createGift(db, admin, { name: "Nano Puff jacket – M", unitPrice: "199" });
    const sign = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Hand-painted sign" });
    await reserve(db, admin, { eventId: gala.id, itemId: chair.id, count: 10 });
    await reserve(db, admin, { eventId: gala.id, itemId: jacket.id, count: 2 });
    await reserve(db, admin, { eventId: gala.id, itemId: sign.id, count: 1 });

    expect((await loadEventScreen(db, gala.id))?.reservedCents).toBe(52300);
  });
});

describe("an Event's Shortages", () => {
  let db: Db;
  let admin: Awaited<ReturnType<typeof addUser>>;
  let actor: Awaited<ReturnType<typeof addUser>>;
  let warehouse: { id: string };
  beforeAll(async () => {
    db = await testDb();
    admin = await addUser(db, { role: "admin", name: "Avery Lane" });
    actor = await addUser(db, { role: "user" });
    warehouse = await createLocation(db, admin, { name: "Warehouse" });
  });
  // Far enough ahead that the days are still to come whenever this runs.
  const plan = (name: string, startsOn: string, endsOn: string) =>
    createEvent(db, actor, { name, client: { name: "Acme" }, startsOn, endsOn });

  it("names the short item and the Events competing for it", async () => {
    const tents = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Tent",
      startingStock: { locationId: warehouse.id, count: 3 },
    });
    const ours = await plan("Ours", "2031-08-01", "2031-08-03");
    const rival = await plan("Rival", "2031-08-03", "2031-08-04");
    const apart = await plan("Apart", "2031-08-10", "2031-08-11");
    await reserve(db, actor, { eventId: ours.id, itemId: tents.id, count: 2 });
    await reserve(db, actor, { eventId: rival.id, itemId: tents.id, count: 2 });
    await reserve(db, actor, { eventId: apart.id, itemId: tents.id, count: 3 });

    expect((await loadEventScreen(db, ours.id))?.shortages).toEqual([
      {
        item: { id: tents.id, name: "Tent" },
        shortBy: 1,
        competing: [{ event: { id: rival.id, name: "Rival", startsOn: "2031-08-03", endsOn: "2031-08-04" }, reserved: 2 }],
        acknowledged: null,
        flagged: true,
      },
    ]);
  });

  it("keeps an Admin's acknowledgement, with who and the note, and stops flagging it", async () => {
    const arch = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Balloon arch",
      startingStock: { locationId: warehouse.id, count: 1 },
    });
    const ours = await plan("Ours", "2031-09-01", "2031-09-01");
    const rival = await plan("Rival", "2031-09-01", "2031-09-01");
    await reserve(db, actor, { eventId: ours.id, itemId: arch.id, count: 1 });
    await reserve(db, actor, { eventId: rival.id, itemId: arch.id, count: 1 });

    await acknowledgeShortage(db, admin, { eventId: rival.id, itemId: arch.id, note: "Renting one from Party City", shortBy: 1 });

    expect((await loadEventScreen(db, ours.id))?.shortages).toMatchObject([
      {
        shortBy: 1,
        acknowledged: { shortBy: 1, by: "Avery Lane", note: "Renting one from Party City", recordedAt: expect.any(Date) },
        flagged: false,
      },
    ]);
  });
});

describe("an Event that has ended", () => {
  it("says it has ended the day after its last day, and shows what its Gifts gave away", async () => {
    const db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    const actor = await addUser(db);
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    const caps = await createGift(db, admin, { name: "Cap", startingStock: { locationId: warehouse.id, count: 3 } });
    const gala = await createEvent(db, actor, { name: "Gala", client: { name: "Acme" }, startsOn: "2026-01-10" });
    await reserve(db, actor, { eventId: gala.id, itemId: caps.id, count: 5 });

    expect(await loadEventScreen(db, gala.id, new Date("2026-01-10T23:00:00-07:00"))).toMatchObject({
      ended: false,
      gifts: [{ reserved: 5, givenAway: null }],
    });
    await giveAwayEnded(db);
    expect(await loadEventScreen(db, gala.id, new Date("2026-01-11T00:30:00-07:00"))).toMatchObject({
      ended: true,
      gifts: [{ reserved: 5, givenAway: 3 }],
    });
  });
});

describe("who added an Event's Lines", () => {
  it("names who added each Line and on which day, keeps them when someone reserves more, and has nobody for an older Line", async () => {
    const db = await testDb();
    const admin = await addUser(db, { role: "admin", name: "Aaron" });
    const bea = await addUser(db, { role: "user", name: "Bea" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    const chairs = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Chairs",
      startingStock: { locationId: warehouse.id, count: 10 },
    });
    const gala = await createEvent(db, bea, { name: "Gala", client: { name: "Acme" }, startsOn: "2030-06-10" });
    await reserve(db, bea, { eventId: gala.id, itemId: chairs.id, count: 2 });
    await reserve(db, admin, { eventId: gala.id, itemId: chairs.id, count: 1 });
    // Added before who added it was kept.
    await db.insert(line).values({ eventId: gala.id, kind: "borrowed", name: "Photo booth", lender: "", reserved: 1 });

    const screen = await loadEventScreen(db, gala.id);

    expect(screen?.inventory.map((l) => [l.name, l.reserved, l.addedBy])).toEqual([
      ["Chairs", 3, { name: "Bea", colour: expect.any(Number), on: todayInMuse() }],
      ["Photo booth", 1, null],
    ]);
  });

  it("keeps the name of someone since deleted", async () => {
    const db = await testDb();
    const admin = await addUser(db, { role: "admin", name: "Aaron" });
    const bea = await addUser(db, { role: "user", name: "Bea" });
    const gala = await createEvent(db, bea, { name: "Gala", client: { name: "Acme" } });
    await addBorrowedItem(db, bea, { eventId: gala.id, name: "Photo booth", count: 1 });
    await deleteUser(db, admin, { userId: bea.userId });

    expect((await loadEventScreen(db, gala.id))?.inventory[0].addedBy).toMatchObject({ name: "Bea" });
  });
});
