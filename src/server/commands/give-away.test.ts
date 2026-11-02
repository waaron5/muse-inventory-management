import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { event as eventTable } from "@/db/schema";
import type { Db } from "@/db/types";
import { todayInMuse } from "@/lib/time-zone";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { stockOffLedger } from "@/test/ledger";
import { loadEventScreen } from "../loaders/event";
import { loadGiftScreen } from "../loaders/item";
import { createEvent } from "./create-event";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { giveAwayEnded } from "./give-away";
import { reserve } from "./reserve";

let db: Db;
let admin: Awaited<ReturnType<typeof addUser>>;
let someone: Awaited<ReturnType<typeof addUser>>;
let warehouse: { id: string };
let garage: { id: string };
beforeAll(async () => {
  db = await testDb();
  admin = await addUser(db, { role: "admin" });
  someone = await addUser(db, { role: "user" });
  warehouse = await createLocation(db, admin, { name: "Warehouse" });
  garage = await createLocation(db, admin, { name: "Garage" });
});

/** A calendar day `n` days from today in Muse's time zone; negative is past. */
function day(n: number) {
  const [y, m, d] = todayInMuse().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const plan = (name: string, dates: { startsOn?: string; endsOn?: string }) =>
  createEvent(db, someone, { name, client: { name: "Acme" }, ...dates });
const gift = (name: string, stock: { warehouse?: number; garage?: number }) =>
  createGift(db, admin, {
    name,
    startingStock: stock.garage
      ? { locationId: garage.id, count: stock.garage }
      : { locationId: warehouse.id, count: stock.warehouse ?? 0 },
  });
const stockOf = async (itemId: string) => {
  const screen = (await loadGiftScreen(db, itemId))!;
  return { [screen.location!.name]: screen.count };
};
// Latest first, and the most first within one day.
const givenAway = async (itemId: string) =>
  (await loadGiftScreen(db, itemId))!.history
    .filter((h) => h.kind === "given-away")
    .sort((a, b) => b.happenedOn.localeCompare(a.happenedOn) || b.count - a.count);

describe("giveAwayEnded", () => {
  it("gives away an Event's reserved Gifts the day after it ends, from its Location, once", async () => {
    const jacket = await gift("Nano Puff jacket – M", { garage: 13 });
    const gala = await plan("Ended yesterday", { startsOn: day(-3), endsOn: day(-1) });
    const line = await reserve(db, someone, { eventId: gala.id, itemId: jacket.id, count: 12 });

    await giveAwayEnded(db);

    expect(await stockOf(jacket.id)).toEqual({ Garage: 1 });
    expect(await givenAway(jacket.id)).toMatchObject([
      { count: 12, from: "Garage", by: "Automatic", happenedOn: day(-1), event: { id: gala.id } },
    ]);
    expect((await loadEventScreen(db, gala.id))!.gifts).toMatchObject([{ id: line.id, reserved: 12, givenAway: 12 }]);

    await giveAwayEnded(db);
    expect(await stockOf(jacket.id)).toEqual({ Garage: 1 });
    expect(await givenAway(jacket.id)).toHaveLength(1);
    expect(await stockOffLedger(db)).toEqual([]);
  });

  it("never gives away more than is in Stock", async () => {
    const tote = await gift("Tote bag", { warehouse: 4 });
    const gala = await plan("Short of totes", { startsOn: day(-1) });
    await reserve(db, someone, { eventId: gala.id, itemId: tote.id, count: 9 });

    await giveAwayEnded(db);

    expect(await stockOf(tote.id)).toEqual({ Warehouse: 0 });
    expect(await givenAway(tote.id)).toMatchObject([{ count: 4, from: "Warehouse" }]);
    expect((await loadEventScreen(db, gala.id))!.gifts).toMatchObject([{ reserved: 9, givenAway: 4 }]);
  });

  it("catches up on Events that ended days ago, one after another from the same Stock", async () => {
    const cap = await gift("Trucker cap", { warehouse: 10 });
    const first = await plan("Ended last week", { startsOn: day(-9), endsOn: day(-7) });
    const second = await plan("Ended two days ago", { endsOn: day(-2) });
    await reserve(db, someone, { eventId: second.id, itemId: cap.id, count: 6 });
    await reserve(db, someone, { eventId: first.id, itemId: cap.id, count: 6 });

    await giveAwayEnded(db);

    expect(await givenAway(cap.id)).toMatchObject([
      { count: 4, happenedOn: day(-2), event: { id: second.id } },
      { count: 6, happenedOn: day(-7), event: { id: first.id } },
    ]);
  });

  it("leaves Events still on or to come, Events without dates, Cancelled Events and Inventory alone", async () => {
    const bottle = await gift("Water bottle", { warehouse: 20 });
    const chairs = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Folding chair",
      startingStock: { locationId: warehouse.id, count: 8 },
    });
    const today = await plan("Ends today", { startsOn: day(-2), endsOn: day(0) });
    const coming = await plan("Coming up", { startsOn: day(5) });
    const undated = await plan("No dates yet", {});
    const called = await plan("Cancelled in time", { startsOn: day(-1) });
    const ended = await plan("Chairs only", { startsOn: day(-1) });
    for (const e of [today, coming, undated, called]) await reserve(db, someone, { eventId: e.id, itemId: bottle.id, count: 2 });
    await reserve(db, someone, { eventId: ended.id, itemId: chairs.id, count: 8 });
    // Cancelled before it ended, as only then it can be.
    await db.update(eventTable).set({ cancelledAt: new Date() }).where(eq(eventTable.id, called.id));

    await giveAwayEnded(db);

    expect(await givenAway(bottle.id)).toEqual([]);
    expect(await stockOf(bottle.id)).toEqual({ Warehouse: 20 });
    expect((await loadEventScreen(db, ended.id))!.inventory).toMatchObject([{ reserved: 8 }]);
  });

  it("releases the Gift's hold once it's given away, so what went isn't counted twice", async () => {
    const pin = await gift("Enamel pin", { warehouse: 10 });
    const gone = await plan("Pinned", { startsOn: day(-1) });
    const next = await plan("Pins next", { startsOn: day(10) });
    await reserve(db, someone, { eventId: gone.id, itemId: pin.id, count: 7 });
    await reserve(db, someone, { eventId: next.id, itemId: pin.id, count: 2 });
    const pinsFor = async () =>
      (await loadEventScreen(db, next.id))!.reservable.gifts.find((g) => g.id === pin.id)?.available;
    expect(await pinsFor()).toBe(3);

    await giveAwayEnded(db);

    expect(await pinsFor()).toBe(3);
    expect((await loadEventScreen(db, next.id))!.shortages).toEqual([]);
  });
});
