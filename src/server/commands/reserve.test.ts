import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { event as eventTable, item } from "@/db/schema";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { loadEventScreen } from "../loaders/event";
import { createEvent } from "./create-event";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { reserve } from "./reserve";

let db: Db;
let admin: Awaited<ReturnType<typeof addUser>>;
let actor: Awaited<ReturnType<typeof addUser>>;
beforeAll(async () => {
  db = await testDb();
  admin = await addUser(db, { role: "admin" });
  actor = await addUser(db, { role: "user" });
});

const dated = { startsOn: "2026-11-04", endsOn: "2026-11-06" };

describe("reserve", () => {
  it("lets a User put an Inventory Item on an Event as a Line", async () => {
    const event = await createEvent(db, actor, { name: "Summit", client: { name: "Acme" }, ...dated });
    const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });

    await reserve(db, actor, { eventId: event.id, itemId: chair.id, count: 12 });

    expect((await loadEventScreen(db, event.id))?.inventory).toMatchObject([
      { item: { id: chair.id, name: "Folding chair" }, reserved: 12 },
    ]);
  });

  it("raises the Line when the same item is reserved again", async () => {
    const event = await createEvent(db, actor, { name: "Summit", client: { name: "Acme" }, ...dated });
    const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });

    const first = await reserve(db, actor, { eventId: event.id, itemId: chair.id, count: 12 });
    const again = await reserve(db, actor, { eventId: event.id, itemId: chair.id, count: 4 });

    expect(again).toEqual(first);
    expect((await loadEventScreen(db, event.id))?.inventory).toMatchObject([{ reserved: 16 }]);
  });

  it("needs the Event's dates before an Inventory Item goes on it", async () => {
    const event = await createEvent(db, actor, { name: "Someday", client: { name: "Acme" } });
    const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });

    await expect(reserve(db, actor, { eventId: event.id, itemId: chair.id, count: 2 })).rejects.toMatchObject({
      code: "invalid",
      message: "Give the Event its dates before reserving Inventory.",
    });
  });

  it("puts a Gift on an Event without dates, since a Gift's hold has no window", async () => {
    const event = await createEvent(db, actor, { name: "Someday", client: { name: "Acme" } });
    const jacket = await createGift(db, admin, { name: "Nano Puff jacket – M" });

    await reserve(db, actor, { eventId: event.id, itemId: jacket.id, count: 30 });

    expect(await loadEventScreen(db, event.id)).toMatchObject({
      inventory: [],
      gifts: [{ item: { name: "Nano Puff jacket – M" }, reserved: 30 }],
    });
  });

  it("refuses an Archived item", async () => {
    const event = await createEvent(db, actor, { name: "Summit", client: { name: "Acme" }, ...dated });
    const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Old chair" });
    await db.update(item).set({ archivedAt: new Date() }).where(eq(item.id, chair.id));

    await expect(reserve(db, actor, { eventId: event.id, itemId: chair.id, count: 2 })).rejects.toMatchObject({
      code: "invalid",
      message: "Old chair is Archived, so it can't be reserved.",
    });
  });

  it("refuses an Event that isn't there, or is Cancelled", async () => {
    const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });
    const event = await createEvent(db, actor, { name: "Summit", client: { name: "Acme" }, ...dated });
    await db.update(eventTable).set({ cancelledAt: new Date() }).where(eq(eventTable.id, event.id));

    await expect(
      reserve(db, actor, { eventId: "00000000-0000-4000-8000-000000000000", itemId: chair.id, count: 2 }),
    ).rejects.toMatchObject({ code: "invalid", message: "That Event no longer exists." });
    await expect(reserve(db, actor, { eventId: event.id, itemId: chair.id, count: 2 })).rejects.toMatchObject({
      code: "invalid",
      message: "Reinstate the Event before reserving for it.",
    });
  });
});
