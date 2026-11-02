import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { todayInMuse } from "@/lib/time-zone";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { loadItemScreen, loadGiftScreen } from "../loaders/item";
import { loadEventScreen } from "../loaders/event";
import { loadEventsScreen } from "../loaders/events";
import { acknowledgeShortage } from "./acknowledge-shortage";
import { addBorrowedItem } from "./add-line";
import { cancelEvent, deleteEvent, reinstateEvent } from "./cancel-event";
import { changeReserved } from "./change-line";
import { createEvent } from "./create-event";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { giveAwayEnded } from "./give-away";
import { addPastUsePhoto } from "./photos";
import { reserve } from "./reserve";

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

const missing = "00000000-0000-4000-8000-000000000000";

const plan = (name: string) =>
  createEvent(db, someone, { name, client: { name: "Acme" }, startsOn: "2030-06-10", endsOn: "2030-06-12" });
const stocked = (name: string, count: number) =>
  createInventoryItem(db, admin, { categoryId: testCategoryId, name, startingStock: { locationId: warehouse.id, count } });
const available = async (eventId: string, itemId: string) => {
  const screen = await loadEventScreen(db, eventId);
  return [...screen!.reservable.inventory, ...screen!.reservable.gifts].find((i) => i.id === itemId)?.available;
};
const cancelledTab = async () => (await loadEventsScreen(db, { tab: "cancelled" })).events.map((e) => e.name);

describe("cancelEvent", () => {
  it("lets a User cancel an Event: it releases its Reservations and moves to Cancelled", async () => {
    const chairs = await stocked("Folding chair", 10);
    const bag = await createGift(db, admin, { name: "Tote bag", startingStock: { locationId: warehouse.id, count: 5 } });
    const gala = await plan("Gala");
    const rival = await plan("Rival");
    await reserve(db, someone, { eventId: gala.id, itemId: chairs.id, count: 8 });
    await reserve(db, someone, { eventId: gala.id, itemId: bag.id, count: 3 });

    await cancelEvent(db, someone, { id: gala.id });

    expect(await available(rival.id, chairs.id)).toBe(10);
    expect(await available(rival.id, bag.id)).toBe(5);
    expect(await loadEventScreen(db, gala.id)).toMatchObject({ cancelled: true });
    expect(await cancelledTab()).toContain("Gala");
  });

  it("is allowed until the Event's last day, and refused once it has ended", async () => {
    const today = todayInMuse();
    const lastDay = await createEvent(db, someone, { name: "Last day", client: { name: "Acme" }, startsOn: "2026-01-01", endsOn: today });
    const over = await createEvent(db, someone, { name: "Over", client: { name: "Acme" }, startsOn: "2026-01-01", endsOn: "2026-01-02" });
    const undated = await createEvent(db, someone, { name: "Undated", client: { name: "Acme" } });

    await cancelEvent(db, someone, { id: lastDay.id });
    await cancelEvent(db, someone, { id: undated.id });
    await expect(cancelEvent(db, someone, { id: over.id })).rejects.toMatchObject({
      code: "invalid",
      message: "This Event has ended, so it can't be cancelled.",
    });
    expect(await loadEventScreen(db, over.id)).toMatchObject({ cancelled: false, ended: true });
  });

  it("refuses an Event that's gone or already Cancelled", async () => {
    const gala = await plan("Twice");
    await cancelEvent(db, someone, { id: gala.id });

    await expect(cancelEvent(db, someone, { id: gala.id })).rejects.toMatchObject({
      code: "invalid",
      message: "This Event is already Cancelled.",
    });
    await expect(cancelEvent(db, someone, { id: missing })).rejects.toMatchObject({
      code: "invalid",
      message: "That Event no longer exists.",
    });
  });
});

describe("reinstateEvent", () => {
  it("lets a User bring back every Reservation it had, flagging any Shortage since", async () => {
    const chairs = await stocked("Chiavari chair", 10);
    const gala = await plan("Reinstated gala");
    const rival = await plan("Took the chairs");
    await reserve(db, someone, { eventId: gala.id, itemId: chairs.id, count: 8 });
    const before = (await loadEventScreen(db, gala.id))!;
    await cancelEvent(db, someone, { id: gala.id });
    await reserve(db, someone, { eventId: rival.id, itemId: chairs.id, count: 6 });

    await reinstateEvent(db, someone, { id: gala.id });

    const after = (await loadEventScreen(db, gala.id))!;
    expect(after.cancelled).toBe(false);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.gifts).toEqual(before.gifts);
    expect(after.shortages).toMatchObject([{ item: { id: chairs.id }, shortBy: 4, flagged: true }]);
    expect(await available(rival.id, chairs.id)).toBe(2);
    expect(await cancelledTab()).not.toContain("Reinstated gala");
  });

  it("refuses an Event that isn't Cancelled", async () => {
    const gala = await plan("Never cancelled");

    await expect(reinstateEvent(db, someone, { id: gala.id })).rejects.toMatchObject({
      code: "invalid",
      message: "This Event isn't Cancelled.",
    });
  });
});

describe("deleteEvent", () => {
  it("lets an Admin delete an Event in no History, Lines and all", async () => {
    const chairs = await stocked("Lounge chair", 4);
    const gala = await plan("Mistake");
    const rival = await plan("Mistake's rival");
    await reserve(db, someone, { eventId: gala.id, itemId: chairs.id, count: 3 });
    await reserve(db, someone, { eventId: rival.id, itemId: chairs.id, count: 3 });
    await addBorrowedItem(db, someone, { eventId: gala.id, name: "Easel", lender: "Hilton", count: 1 });
    await acknowledgeShortage(db, admin, { eventId: gala.id, itemId: chairs.id, note: "Renting 2", shortBy: 2 });
    expect(await loadEventScreen(db, gala.id)).toMatchObject({ inHistory: false });

    await deleteEvent(db, admin, { id: gala.id });

    expect(await loadEventScreen(db, gala.id)).toBeNull();
    expect(await available(rival.id, chairs.id)).toBe(4);
    expect((await loadEventScreen(db, rival.id))?.shortages).toEqual([]);
  });

  it("deletes an Event in History while keeping its giveaway and correction", async () => {
    const bag = await createGift(db, admin, { name: "Duffel bag", startingStock: { locationId: warehouse.id, count: 4 } });
    const gala = await createEvent(db, someone, { name: "Given out", client: { name: "Acme" }, startsOn: "2026-01-10" });
    const bags = await reserve(db, someone, { eventId: gala.id, itemId: bag.id, count: 2 });
    await giveAwayEnded(db);
    await changeReserved(db, someone, { lineId: bags.id, count: 1 });

    expect(await loadEventScreen(db, gala.id)).toMatchObject({ inHistory: true });
    await deleteEvent(db, admin, { id: gala.id });
    expect(await loadEventScreen(db, gala.id)).toBeNull();
    expect((await loadGiftScreen(db, bag.id))!.count).toBe(3);
  });

  it("deletes an Event while keeping its name on a Past-use Photo", async () => {
    const chairs = await stocked("Photographed chair", 2);
    const gala = await createEvent(db, someone, { name: "Photographed", client: { name: "Acme" }, startsOn: "2026-01-10" });
    await reserve(db, someone, { eventId: gala.id, itemId: chairs.id, count: 2 });
    await addPastUsePhoto(db, someone, { itemId: chairs.id, photo: crypto.randomUUID(), eventId: gala.id });

    await deleteEvent(db, admin, { id: gala.id });
    expect((await loadItemScreen(db, chairs.id))!.pastUses[0]).toMatchObject({ event: { name: "Photographed" }, eventDeleted: true });
  });

  it("is refused to a User", async () => {
    const gala = await plan("Not yours to delete");

    await expect(deleteEvent(db, someone, { id: gala.id })).rejects.toMatchObject({ code: "not-allowed" });
    expect(await loadEventScreen(db, gala.id)).not.toBeNull();
  });

  it("refuses an Event that's gone", async () => {
    await expect(deleteEvent(db, admin, { id: missing })).rejects.toMatchObject({
      code: "invalid",
      message: "That Event no longer exists.",
    });
  });
});
