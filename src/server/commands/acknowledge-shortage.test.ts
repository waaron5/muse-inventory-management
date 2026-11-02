import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { loadEventsScreen } from "../loaders/events";
import { acknowledgeShortage } from "./acknowledge-shortage";
import { changeReserved } from "./change-line";
import { createEvent } from "./create-event";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { reserve } from "./reserve";

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
const stocked = (name: string, count: number) =>
  createInventoryItem(db, admin, { categoryId: testCategoryId, name, startingStock: { locationId: warehouse.id, count } });
const shortBy = async () =>
  Object.fromEntries((await loadEventsScreen(db, {})).events.map((e) => [e.name, e.shortBy]));

/** Two Events wanting 7 and 6 of 10 chairs on a shared day: short by 3. */
async function clash(prefix: string, startsOn: string) {
  const chairs = await stocked(`${prefix} chair`, 10);
  const a = await plan(`${prefix} A`, startsOn, startsOn);
  const b = await plan(`${prefix} B`, startsOn, startsOn);
  const lineA = await reserve(db, actor, { eventId: a.id, itemId: chairs.id, count: 7 });
  await reserve(db, actor, { eventId: b.id, itemId: chairs.id, count: 6 });
  return { chairs, a, b, lineA };
}

describe("acknowledgeShortage", () => {
  it("clears the flag on every competing Event", async () => {
    const { chairs, a } = await clash("Cleared", "2031-03-02");
    expect(await shortBy()).toMatchObject({ "Cleared A": 3, "Cleared B": 3 });

    await acknowledgeShortage(db, admin, { eventId: a.id, itemId: chairs.id, note: "Borrowing 3 from the Hilton", shortBy: 3 });

    expect(await shortBy()).toMatchObject({ "Cleared A": null, "Cleared B": null });
  });

  it("flags them all again when the Shortage grows by one", async () => {
    const { chairs, a, lineA } = await clash("Grown", "2031-04-02");
    await acknowledgeShortage(db, admin, { eventId: a.id, itemId: chairs.id, note: "Borrowing 3", shortBy: 3 });

    await changeReserved(db, actor, { lineId: lineA.id, count: 8 });

    expect(await shortBy()).toMatchObject({ "Grown A": 4, "Grown B": 4 });
  });

  it("keeps each competing Event to its own Shortage, so it's flagged once that grows", async () => {
    const tent = await stocked("Own tent", 1);
    const long = await plan("Own long", "2031-08-01", "2031-08-10");
    const early = await plan("Own early", "2031-08-01", "2031-08-02");
    const late = await plan("Own late", "2031-08-10", "2031-08-10");
    await reserve(db, actor, { eventId: long.id, itemId: tent.id, count: 1 });
    const earlyLine = await reserve(db, actor, { eventId: early.id, itemId: tent.id, count: 1 });
    await reserve(db, actor, { eventId: late.id, itemId: tent.id, count: 3 });
    expect(await shortBy()).toMatchObject({ "Own long": 3, "Own early": 1, "Own late": 3 });

    await acknowledgeShortage(db, admin, { eventId: long.id, itemId: tent.id, note: "Renting", shortBy: 3 });
    await changeReserved(db, actor, { lineId: earlyLine.id, count: 2 });

    expect(await shortBy()).toMatchObject({ "Own early": 2 });
  });

  it("flags it again when a new Event joins the clash, however small", async () => {
    const { chairs, a, lineA } = await clash("Joined", "2031-09-02");
    await acknowledgeShortage(db, admin, { eventId: a.id, itemId: chairs.id, note: "Borrowing 3", shortBy: 3 });

    // One fewer for A, one for a newcomer: still short by 3, but not the clash acknowledged.
    await changeReserved(db, actor, { lineId: lineA.id, count: 6 });
    const newcomer = await plan("Joined C", "2031-09-02", "2031-09-02");
    await reserve(db, actor, { eventId: newcomer.id, itemId: chairs.id, count: 1 });

    expect(await shortBy()).toMatchObject({ "Joined A": 3, "Joined B": 3, "Joined C": 3 });
  });

  it("refuses a Shortage that has changed since it was shown", async () => {
    const { chairs, a, lineA } = await clash("Changed", "2031-10-02");
    await changeReserved(db, actor, { lineId: lineA.id, count: 9 });

    await expect(
      acknowledgeShortage(db, admin, { eventId: a.id, itemId: chairs.id, note: "Borrowing 3", shortBy: 3 }),
    ).rejects.toThrow("It's now short by 5. Check the Events again before acknowledging.");
  });

  it("refuses a User", async () => {
    const { chairs, a } = await clash("Refused", "2031-05-02");

    await expect(
      acknowledgeShortage(db, actor, { eventId: a.id, itemId: chairs.id, note: "Fine by me", shortBy: 3 }),
    ).rejects.toMatchObject({ code: "not-allowed" });
    expect(await shortBy()).toMatchObject({ "Refused A": 3, "Refused B": 3 });
  });

  it("asks for a note", async () => {
    const { chairs, a } = await clash("Unnoted", "2031-06-02");

    await expect(acknowledgeShortage(db, admin, { eventId: a.id, itemId: chairs.id, note: "  ", shortBy: 3 })).rejects.toThrow(
      "Say how it will be covered.",
    );
  });

  it("finds nothing to acknowledge once the numbers have resolved it", async () => {
    const { chairs, a, lineA } = await clash("Resolved", "2031-07-02");
    await changeReserved(db, actor, { lineId: lineA.id, count: 4 });

    await expect(acknowledgeShortage(db, admin, { eventId: a.id, itemId: chairs.id, note: "Late", shortBy: 3 })).rejects.toThrow(
      "isn't short any more",
    );
  });
});
