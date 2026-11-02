import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { event as eventTable } from "@/db/schema";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { stockOffLedger } from "@/test/ledger";
import { loadEventScreen } from "../loaders/event";
import { loadGiftScreen } from "../loaders/item";
import { changeReserved, removeLine } from "./change-line";
import { createEvent } from "./create-event";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { editGift } from "./edit-inventory-item";
import { giveAwayEnded } from "./give-away";
import { reserve } from "./reserve";

let db: Db;
let admin: Awaited<ReturnType<typeof addUser>>;
let actor: Awaited<ReturnType<typeof addUser>>;
let event: { id: string };
let chair: { id: string };
beforeAll(async () => {
  db = await testDb();
  admin = await addUser(db, { role: "admin" });
  actor = await addUser(db, { role: "user" });
  event = await createEvent(db, actor, { name: "Summit", client: { name: "Acme" }, startsOn: "2026-11-04" });
  chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });
});

const missing = "00000000-0000-4000-8000-000000000000";

describe("changeReserved", () => {
  it("lets a User set a Line's count", async () => {
    const { id } = await reserve(db, actor, { eventId: event.id, itemId: chair.id, count: 12 });

    await changeReserved(db, actor, { lineId: id, count: 8 });

    expect((await loadEventScreen(db, event.id))?.inventory).toMatchObject([{ id, reserved: 8 }]);
  });

  it("refuses a count under 1 or a Line that isn't there", async () => {
    const { id } = await reserve(db, actor, { eventId: event.id, itemId: chair.id, count: 1 });

    await expect(changeReserved(db, actor, { lineId: id, count: 0 })).rejects.toMatchObject({
      code: "invalid",
      message: "Reserve at least 1, or remove the Line.",
    });
    await expect(changeReserved(db, actor, { lineId: missing, count: 3 })).rejects.toMatchObject({
      code: "invalid",
      message: "That Line was removed.",
    });
  });
});

describe("removeLine", () => {
  it("lets a User take a Line off an Event, releasing its hold", async () => {
    const { id } = await reserve(db, actor, { eventId: event.id, itemId: chair.id, count: 4 });

    await removeLine(db, actor, { lineId: id });

    expect((await loadEventScreen(db, event.id))?.inventory).toEqual([]);
    await expect(removeLine(db, actor, { lineId: id })).rejects.toMatchObject({
      code: "invalid",
      message: "That Line was removed.",
    });
  });
});

describe("a Cancelled Event's Lines", () => {
  it("stay as they were, to come back when it's reinstated", async () => {
    const gala = await createEvent(db, actor, { name: "Gala", client: { name: "Acme" }, startsOn: "2026-12-01" });
    const { id } = await reserve(db, actor, { eventId: gala.id, itemId: chair.id, count: 6 });
    await db.update(eventTable).set({ cancelledAt: new Date() }).where(eq(eventTable.id, gala.id));

    const refusal = { code: "invalid", message: "Reinstate the Event before changing what it has reserved." };
    await expect(changeReserved(db, actor, { lineId: id, count: 2 })).rejects.toMatchObject(refusal);
    await expect(removeLine(db, actor, { lineId: id })).rejects.toMatchObject(refusal);
    expect((await loadEventScreen(db, gala.id))?.inventory).toMatchObject([{ id, reserved: 6 }]);
  });
});

describe("a past Gift Line's count", () => {
  // Jackets given away at a Gala that ended last week: 8 from the Warehouse, 1 left.
  async function givenAway(name: string) {
    const warehouse = await createLocation(db, admin, { name: `Warehouse for ${name}` });
    const garage = await createLocation(db, admin, { name: `Garage for ${name}` });
    const jacket = await createGift(db, admin, { name, startingStock: { locationId: warehouse.id, count: 9 } });
    const gala = await createEvent(db, actor, { name: `Gala for ${name}`, client: { name: "Acme" }, endsOn: "2026-01-15" });
    const line = await reserve(db, actor, { eventId: gala.id, itemId: jacket.id, count: 8 });
    await giveAwayEnded(db);
    const stockOf = async () => {
      const screen = (await loadGiftScreen(db, jacket.id))!;
      return { [screen.location!.name]: screen.count };
    };
    const history = async () => (await loadGiftScreen(db, jacket.id))!.history;
    return { jacket, gala, line, warehouse, garage, stockOf, history };
  }

  it("puts leftovers back at the item's Location, recorded in History", async () => {
    const { jacket, gala, line, garage, stockOf, history } = await givenAway("Jacket – leftovers");
    expect(await stockOf()).toEqual({ "Warehouse for Jacket – leftovers": 1 });

    await changeReserved(db, actor, { lineId: line.id, count: 1 });

    expect(await stockOf()).toEqual({ "Warehouse for Jacket – leftovers": 8 });
    // Moved since: the last one back lands where the item is now.
    await editGift(db, admin, { id: jacket.id, name: "Jacket – leftovers", stock: { locationId: garage.id, count: 8, expectedCount: 8 } });
    await changeReserved(db, actor, { lineId: line.id, count: 0 });

    expect(await stockOf()).toEqual({ "Garage for Jacket – leftovers": 9 });
    const putBack = (await history()).filter((h) => h.kind === "giveaway-correction").sort((a, b) => b.count - a.count);
    expect(putBack).toMatchObject([
      { count: 7, to: "Warehouse for Jacket – leftovers", by: "Test person", happenedOn: "2026-01-15" },
      { count: 1, to: "Garage for Jacket – leftovers", by: "Test person", happenedOn: "2026-01-15" },
    ]);
    // What was reserved stays as it was.
    expect((await loadEventScreen(db, gala.id))!.gifts).toMatchObject([{ reserved: 8, givenAway: 0 }]);
    expect(await stockOffLedger(db)).toEqual([]);
  });

  it("gives away more when more went, from its Location", async () => {
    const { gala, line, stockOf } = await givenAway("Jacket – more");

    await changeReserved(db, actor, { lineId: line.id, count: 9 });

    expect(await stockOf()).toEqual({ "Warehouse for Jacket – more": 0 });
    expect((await loadEventScreen(db, gala.id))!.gifts).toMatchObject([{ reserved: 8, givenAway: 9 }]);
    await expect(changeReserved(db, actor, { lineId: line.id, count: 10 })).rejects.toMatchObject({
      code: "invalid",
      message: "There are no Jacket – more in storage to give away.",
    });
    expect(await stockOffLedger(db)).toEqual([]);
  });

  it("counts from what went when Stock ran short, and can put it all back", async () => {
    const warehouse = await createLocation(db, admin, { name: "Warehouse for hats" });
    const hat = await createGift(db, admin, { name: "Hat", startingStock: { locationId: warehouse.id, count: 6 } });
    const gala = await createEvent(db, actor, { name: "Gala for hats", client: { name: "Acme" }, endsOn: "2026-01-15" });
    const line = await reserve(db, actor, { eventId: gala.id, itemId: hat.id, count: 10 });
    await giveAwayEnded(db);
    expect((await loadEventScreen(db, gala.id))!.gifts).toMatchObject([{ reserved: 10, givenAway: 6 }]);

    // 2 came back: 4 went.
    await changeReserved(db, actor, { lineId: line.id, count: 4 });
    expect((await loadEventScreen(db, gala.id))!.gifts).toMatchObject([{ givenAway: 4 }]);
    // None went after all.
    await changeReserved(db, actor, { lineId: line.id, count: 0 });

    expect((await loadEventScreen(db, gala.id))!.gifts).toMatchObject([{ reserved: 10, givenAway: 0 }]);
    expect((await loadGiftScreen(db, hat.id))!.count).toBe(6);
    expect(await stockOffLedger(db)).toEqual([]);
  });

  it("deletes its Line while keeping the giveaway in History", async () => {
    const { line, gala, stockOf } = await givenAway("Jacket – kept");
    const before = await stockOf();

    await expect(removeLine(db, actor, { lineId: line.id })).rejects.toMatchObject({ code: "not-allowed" });
    await removeLine(db, admin, { lineId: line.id });
    expect((await loadEventScreen(db, gala.id))!.gifts).toEqual([]);
    expect(await stockOf()).toEqual(before);
  });
});
