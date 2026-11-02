import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { event, line } from "@/db/schema";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, countRoundTrips, testDb } from "@/test/db";
import { addBorrowedItem } from "../commands/add-line";
import { adjustStock } from "../commands/adjust-stock";
import { changeReserved } from "../commands/change-line";
import { cancelEvent } from "../commands/cancel-event";
import { createEvent } from "../commands/create-event";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import { giveAwayEnded } from "../commands/give-away";
import { reserve } from "../commands/reserve";
import { loadEventsScreen } from "./events";

// 10pm on 6 November in Denver, and half past midnight on the 7th.
const lateOnThe6th = new Date("2026-11-07T05:00:00Z");
const earlyOnThe7th = new Date("2026-11-07T07:30:00Z");

describe("loadEventsScreen", () => {
  describe("tabs", () => {
    let db: Db;
    beforeAll(async () => {
      db = await testDb();
      const actor = await addUser(db);
      await createEvent(db, actor, {
        name: "Summit",
        client: { name: "Acme" },
        startsOn: "2026-11-04",
        endsOn: "2026-11-06",
      });
    });

    it("keeps an Event ending today in Denver under Upcoming", async () => {
      const screen = await loadEventsScreen(db, { tab: "upcoming" }, lateOnThe6th);

      expect(screen.events.map((e) => e.name)).toEqual(["Summit"]);
      expect(screen.counts).toEqual({ upcoming: 1, past: 0, cancelled: 0 });
    });

    it("moves it to Past from the next day in Denver", async () => {
      const upcoming = await loadEventsScreen(db, { tab: "upcoming" }, earlyOnThe7th);
      const past = await loadEventsScreen(db, { tab: "past" }, earlyOnThe7th);

      expect(upcoming.events).toEqual([]);
      expect(past.events.map((e) => e.name)).toEqual(["Summit"]);
      expect(past.counts).toEqual({ upcoming: 0, past: 1, cancelled: 0 });
    });
  });

  describe("rows", () => {
    let db: Db;
    beforeAll(async () => {
      db = await testDb();
      const actor = await addUser(db);
      const plan = (name: string, clientName: string, startsOn?: string, endsOn?: string) =>
        createEvent(db, actor, { name, client: { name: clientName }, startsOn, endsOn });
      await plan("Someday", "Acme");
      await plan("Roadshow", "Ivorypeak", "2026-12-01", "2026-12-04");
      await createEvent(db, actor, {
        name: "Cove",
        client: { name: "Birchline" },
        plCode: "BRL Cove 26",
        venue: "Grand Vista",
        startsOn: "2026-11-10",
        endsOn: "2026-11-14",
      });
      await plan("Summit", "Ivorypeak", "2026-11-20");
      await plan("Spring Gala", "Acme", "2026-04-01", "2026-04-02");
      await plan("Kickoff", "Acme", "2026-01-12", "2026-01-13");
      const { id } = await plan("Fell through", "Acme", "2026-11-12");
      await db.update(event).set({ cancelledAt: new Date() }).where(eq(event.id, id));
    });

    it("shows each Event's Name, P&L Code, Client, Venue and dates", async () => {
      const { events } = await loadEventsScreen(db, {}, lateOnThe6th);

      expect(events.find((e) => e.name === "Cove")).toEqual({
        id: expect.any(String),
        name: "Cove",
        plCode: "BRL Cove 26",
        client: { name: "Birchline", colour: "violet" },
        venue: "Grand Vista",
        startsOn: "2026-11-10",
        endsOn: "2026-11-14",
        lines: { inventory: 0, gifts: 0 },
        cancelled: false,
        ended: false,
        inHistory: false,
        shortBy: null,
      });
    });

    it("gives two Events for the same Client the same colour", async () => {
      const { events } = await loadEventsScreen(db, {}, lateOnThe6th);
      const ivorypeak = events.filter((e) => e.client.name === "Ivorypeak");

      expect(ivorypeak).toHaveLength(2);
      expect(ivorypeak[0].client.colour).toBe(ivorypeak[1].client.colour);
    });

    it("lists Upcoming soonest first, with Events still without dates at the bottom", async () => {
      const { events } = await loadEventsScreen(db, { tab: "upcoming" }, lateOnThe6th);

      expect(events.map((e) => e.name)).toEqual(["Cove", "Summit", "Roadshow", "Someday"]);
    });

    it("lists Past most recent first", async () => {
      const { events } = await loadEventsScreen(db, { tab: "past" }, lateOnThe6th);

      expect(events.map((e) => e.name)).toEqual(["Spring Gala", "Kickoff"]);
    });

    it("lists Cancelled Events without dates at the bottom too", async () => {
      const db = await testDb();
      const actor = await addUser(db);
      const dated = await createEvent(db, actor, { name: "Dated", client: { name: "Acme" }, startsOn: "2031-11-10" });
      const undated = await createEvent(db, actor, { name: "Undated", client: { name: "Acme" } });
      await cancelEvent(db, actor, { id: undated.id });
      await cancelEvent(db, actor, { id: dated.id });

      const { events } = await loadEventsScreen(db, { tab: "cancelled" }, lateOnThe6th);

      expect(events.map((e) => e.name)).toEqual(["Dated", "Undated"]);
    });

    it("keeps Cancelled Events to their own tab", async () => {
      const screen = await loadEventsScreen(db, { tab: "cancelled" }, lateOnThe6th);

      expect(screen.events.map((e) => e.name)).toEqual(["Fell through"]);
      expect(screen.counts).toEqual({ upcoming: 4, past: 2, cancelled: 1 });
    });
  });

  describe("filters", () => {
    let db: Db;
    let ivorypeak: { id: string };
    beforeAll(async () => {
      db = await testDb();
      const actor = await addUser(db);
      const roadshow = await createEvent(db, actor, {
        name: "Roadshow",
        client: { name: "Ivorypeak" },
        plCode: "IVP-Roadshow 26",
        startsOn: "2026-12-01",
      });
      await createEvent(db, actor, {
        name: "Cove",
        client: { name: "Birchline" },
        plCode: "BRL Cove 26",
        venue: "Grand Vista",
        startsOn: "2026-11-10",
        endsOn: "2026-11-14",
      });
      await createEvent(db, actor, { name: "Summit", client: { name: "Ivorypeak" }, startsOn: "2026-11-20" });
      await createEvent(db, actor, { name: "Kickoff", client: { name: "Ivorypeak" }, startsOn: "2026-01-12" });
      await createEvent(db, actor, { name: "Someday", client: { name: "Birchline" } });
      const [row] = await db.select({ id: event.clientId }).from(event).where(eq(event.id, roadshow.id));
      ivorypeak = row;
    });

    const names = async (filters: Parameters<typeof loadEventsScreen>[1]) =>
      (await loadEventsScreen(db, filters, lateOnThe6th)).events.map((e) => e.name);

    it("narrows to one Client's Events, counting each tab within it", async () => {
      const screen = await loadEventsScreen(db, { clientId: ivorypeak.id }, lateOnThe6th);

      expect(screen.events.map((e) => e.name)).toEqual(["Summit", "Roadshow"]);
      expect(screen.counts).toEqual({ upcoming: 2, past: 1, cancelled: 0 });
    });

    it("narrows to the Events overlapping the chosen month, counting each tab within it", async () => {
      const screen = await loadEventsScreen(db, { month: "2026-11" }, lateOnThe6th);

      expect(screen.events.map((e) => e.name)).toEqual(["Cove", "Summit"]);
      expect(screen.counts).toEqual({ upcoming: 2, past: 0, cancelled: 0 });
      expect(screen.dates).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    });

    it("keeps the year with the month and preserves the chosen tab", async () => {
      expect(await names({ month: "2026-12" })).toEqual(["Roadshow"]);
      expect(await names({ month: "2027-11" })).toEqual([]);
      expect(await names({ month: "2026-01", tab: "past" })).toEqual(["Kickoff"]);
    });

    it.each([
      ["2027-02", "2027-02-28"],
      ["2028-02", "2028-02-29"],
      ["2026-12", "2026-12-31"],
    ])("includes every calendar day in %s", async (month, to) => {
      const screen = await loadEventsScreen(db, { month }, lateOnThe6th);
      expect(screen.dates).toEqual({ from: `${month}-01`, to });
    });

    it("narrows by Client and Month together", async () => {
      expect(await names({ clientId: ivorypeak.id, month: "2026-11" })).toEqual(["Summit"]);
    });

    it.each(["soon", "2026-00", "2026-13", "2026-1", "2026-11-01", "0000-02"])("ignores an invalid Month: %s", async (month) => {
      const screen = await loadEventsScreen(db, { clientId: "not-a-client", month }, lateOnThe6th);

      expect(screen.events).toHaveLength(4);
      expect(screen.dates).toBeNull();
    });

    it("offers every Client as a chip", async () => {
      const { clients } = await loadEventsScreen(db, {}, lateOnThe6th);

      expect(clients.map((c) => c.name)).toEqual(["Birchline", "Ivorypeak"]);
    });

    it("stays within 2 sequential round trips, filters and all", async () => {
      const trips = await countRoundTrips(db, () =>
        loadEventsScreen(db, { clientId: ivorypeak.id, month: "2026-11" }, lateOnThe6th),
      );

      expect(trips).toBeLessThanOrEqual(2);
    });
  });

  it("includes events touching either month boundary, including leap day, across tabs", async () => {
    const db = await testDb();
    const actor = await addUser(db);
    const plan = (name: string, startsOn?: string, endsOn?: string) =>
      createEvent(db, actor, { name, client: { name: "Acme" }, startsOn, endsOn });
    await plan("Spans into February", "2028-01-30", "2028-02-01");
    await plan("Leap day", undefined, "2028-02-29");
    await plan("January only", "2028-01-31");
    await plan("March only", "2028-03-01");
    await plan("Another year", "2029-02-01");
    await plan("No dates");
    const cancelled = await plan("Cancelled February", "2028-02-15");
    await db.update(event).set({ cancelledAt: new Date() }).where(eq(event.id, cancelled.id));

    const now = new Date("2028-02-01T18:00:00Z");
    const upcoming = await loadEventsScreen(db, { month: "2028-02" }, now);
    expect(upcoming.events.map((e) => e.name)).toEqual(["Spans into February", "Leap day"]);
    expect(upcoming.counts).toEqual({ upcoming: 2, past: 0, cancelled: 1 });
    const cancelledScreen = await loadEventsScreen(db, { month: "2028-02", tab: "cancelled" }, now);
    expect(cancelledScreen.events.map((e) => e.name)).toEqual(["Cancelled February"]);
  });

  describe("Shortages", () => {
    let db: Db;
    let actor: Awaited<ReturnType<typeof addUser>>;
    let admin: Awaited<ReturnType<typeof addUser>>;
    let warehouse: { id: string };
    let stocked: (name: string, count: number) => Promise<{ id: string }>;
    beforeAll(async () => {
      db = await testDb();
      admin = await addUser(db, { role: "admin" });
      actor = await addUser(db);
      warehouse = await createLocation(db, admin, { name: "Warehouse" });
      stocked = (name, count) =>
        createInventoryItem(db, admin, { categoryId: testCategoryId, name, startingStock: { locationId: warehouse.id, count } });
    });
    const plan = (name: string, startsOn: string, endsOn: string) =>
      createEvent(db, actor, { name, client: { name: "Acme" }, startsOn, endsOn });
    const shortBy = async (tab: "upcoming" | "past" = "upcoming") =>
      Object.fromEntries(
        (await loadEventsScreen(db, { tab }, lateOnThe6th)).events.map((e) => [e.name, e.shortBy]),
      );

    it("flags every Event competing for the short item, not just the newest", async () => {
      const chairs = await stocked("Folding chair", 10);
      const first = await plan("First", "2026-11-10", "2026-11-12");
      const second = await plan("Second", "2026-11-12", "2026-11-14");
      const apart = await plan("Apart", "2026-11-20", "2026-11-21");
      await reserve(db, actor, { eventId: first.id, itemId: chairs.id, count: 6 });
      await reserve(db, actor, { eventId: apart.id, itemId: chairs.id, count: 10 });
      await reserve(db, actor, { eventId: second.id, itemId: chairs.id, count: 7 });

      expect(await shortBy()).toMatchObject({ First: 3, Second: 3, Apart: null });
    });

    it("clears the flag once a Reservation is lowered or stock is added, with no other action", async () => {
      const boards = await stocked("Cornhole set", 2);
      const lowered = await plan("Lowered", "2027-01-05", "2027-01-06");
      const other = await plan("Other", "2027-01-06", "2027-01-07");
      const line = await reserve(db, actor, { eventId: lowered.id, itemId: boards.id, count: 2 });
      await reserve(db, actor, { eventId: other.id, itemId: boards.id, count: 2 });
      expect(await shortBy()).toMatchObject({ Lowered: 2, Other: 2 });

      await changeReserved(db, actor, { lineId: line.id, count: 1 });
      expect(await shortBy()).toMatchObject({ Lowered: 1, Other: 1 });

      await adjustStock(db, admin, { itemId: boards.id, reason: "purchased", count: 1 });
      expect(await shortBy()).toMatchObject({ Lowered: null, Other: null });
    });

    it("makes a Gift short whatever the dates, until a Line is Given Away", async () => {
      const jackets = await createGift(db, admin, {
        name: "Nano Puff jacket – M",
        startingStock: { locationId: warehouse.id, count: 5 },
      });
      const spring = await plan("Spring", "2027-03-01", "2027-03-02");
      const autumn = await plan("Autumn", "2027-09-01", "2027-09-02");
      await reserve(db, actor, { eventId: spring.id, itemId: jackets.id, count: 3 });
      const autumnLine = await reserve(db, actor, { eventId: autumn.id, itemId: jackets.id, count: 4 });
      expect(await shortBy()).toMatchObject({ Spring: 2, Autumn: 2 });

      await db.update(line).set({ givenAwayAt: new Date() }).where(eq(line.id, autumnLine.id));
      expect(await shortBy()).toMatchObject({ Spring: null, Autumn: null });
    });

    it("lets days already gone hold nothing", async () => {
      const arch = await stocked("Balloon arch", 1);
      const gone = await plan("Gone", "2026-11-01", "2026-11-05");
      const ongoing = await plan("Ongoing", "2026-11-05", "2026-11-08");
      await reserve(db, actor, { eventId: gone.id, itemId: arch.id, count: 1 });
      await reserve(db, actor, { eventId: ongoing.id, itemId: arch.id, count: 1 });

      // Today is the 6th: they only met on the 5th.
      expect(await shortBy()).toMatchObject({ Ongoing: null });
      expect(await shortBy("past")).toMatchObject({ Gone: null });
    });
  });

  describe("each row's Lines and menu", () => {
    let db: Db;
    beforeAll(async () => {
      db = await testDb();
      const actor = await addUser(db, { role: "admin" });
      const warehouse = await createLocation(db, actor, { name: "Warehouse" });
      const chairs = await createInventoryItem(db, actor, {
        categoryId: testCategoryId,
        name: "Chair",
        startingStock: { locationId: warehouse.id, count: 10 },
      });
      const jackets = await createGift(db, actor, {
        name: "Jacket",
        startingStock: { locationId: warehouse.id, count: 10 },
      });
      const plan = (name: string) => createEvent(db, actor, { name, client: { name: "Acme" }, startsOn: "2026-11-10" });
      const gala = await plan("Gala");
      await reserve(db, actor, { eventId: gala.id, itemId: chairs.id, count: 4 });
      await addBorrowedItem(db, actor, { eventId: gala.id, name: "Arch", lender: "Venue", count: 1 });
      await reserve(db, actor, { eventId: gala.id, itemId: jackets.id, count: 4 });
      const picnic = await plan("Picnic");
      await reserve(db, actor, { eventId: picnic.id, itemId: jackets.id, count: 1 });
      await plan("Bare");
      // Ended, its jackets Given Away.
      const expo = await createEvent(db, actor, { name: "Expo", client: { name: "Acme" }, startsOn: "2026-10-01" });
      await reserve(db, actor, { eventId: expo.id, itemId: jackets.id, count: 2 });
      await createEvent(db, actor, { name: "Meetup", client: { name: "Acme" }, startsOn: "2026-10-02" });
      await giveAwayEnded(db);
    });

    it("counts its Inventory and Gifts Lines", async () => {
      const { events } = await loadEventsScreen(db, {}, lateOnThe6th);

      expect(events.map((e) => [e.name, e.lines])).toEqual([
        ["Bare", { inventory: 0, gifts: 0 }],
        ["Gala", { inventory: 2, gifts: 1 }],
        ["Picnic", { inventory: 0, gifts: 1 }],
      ]);
    });

    it("says whether it has ended and is in History, for its menu's Cancel and Delete", async () => {
      const upcoming = (await loadEventsScreen(db, {}, lateOnThe6th)).events;
      const past = (await loadEventsScreen(db, { tab: "past" }, lateOnThe6th)).events;

      expect([...upcoming, ...past].map((e) => [e.name, e.ended, e.inHistory])).toEqual([
        ["Bare", false, false],
        ["Gala", false, false],
        ["Picnic", false, false],
        ["Meetup", true, false],
        ["Expo", true, true],
      ]);
    });
  });
});
