import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { event } from "@/db/schema";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { loadEventScreen } from "../loaders/event";
import { loadGiftsScreen } from "../loaders/gifts";
import { loadInventoryScreen } from "../loaders/inventory";
import { addBorrowedItem } from "./add-line";
import { changeReserved, removeLine } from "./change-line";
import { createEvent } from "./create-event";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { editEvent } from "./edit-event";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

/** A Gala on June 10–12, 2030, with 10 chairs in the Warehouse to reserve from. */
async function gala(dates = { startsOn: "2030-06-10", endsOn: "2030-06-12" }) {
  const admin = await addUser(db, { role: "admin", name: "Aaron" });
  const bea = await addUser(db, { role: "user", name: "Bea" });
  const warehouse = await createLocation(db, admin, { name: "Warehouse" });
  const chairs = await createInventoryItem(db, admin, {
    categoryId: testCategoryId,
    name: "Folding chair",
    startingStock: { locationId: warehouse.id, count: 10 },
  });
  const jackets = await createGift(db, admin, { name: "Jacket", startingStock: { locationId: warehouse.id, count: 5 } });
  const created = await createEvent(db, bea, {
    name: "Gala",
    client: { name: "Acme" },
    ...dates,
  });
  return { admin, bea, warehouse, chairs, jackets, gala: created };
}

describe("addBorrowedItem", () => {
  it("puts it under the Event's Inventory with its lender, unpriced and never in the Inventory or Gifts lists", async () => {
    const { bea, gala: { id } } = await gala();

    await addBorrowedItem(db, bea, { eventId: id, name: "  Photo booth ", lender: "Lens & Co", count: 2 });

    const screen = await loadEventScreen(db, id);
    expect(screen?.inventory).toMatchObject([
      { kind: "borrowed", item: null, name: "Photo booth", lender: "Lens & Co", reserved: 2, givenAway: null },
    ]);
    expect(screen?.gifts).toEqual([]);
    expect(screen?.reservedCents).toBe(0);
    expect((await loadInventoryScreen(db, {})).items.map((i) => i.name)).not.toContain("Photo booth");
    expect((await loadGiftsScreen(db, {})).items.map((i) => i.name)).not.toContain("Photo booth");
  });

  it("needs a name, a count and an Event that isn't Cancelled, dates or none; the lender is optional", async () => {
    const { bea, gala: { id } } = await gala();
    const undated = await createEvent(db, bea, { name: "Someday", client: { name: "Acme" } });
    const add = (input: Partial<Parameters<typeof addBorrowedItem>[2]>) =>
      addBorrowedItem(db, bea, { eventId: id, name: "Photo booth", lender: "Lens & Co", count: 1, ...input });

    await add({ eventId: undated.id });
    expect((await loadEventScreen(db, undated.id))?.inventory).toMatchObject([{ name: "Photo booth" }]);
    await expect(add({ name: " " })).rejects.toMatchObject({ code: "invalid", message: "Say what was borrowed." });
    await add({ lender: "" });
    expect((await loadEventScreen(db, id))?.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Photo booth", lender: "", reserved: 1 }),
    ]));
    await expect(add({ count: 0 })).rejects.toMatchObject({ code: "invalid", message: "Borrow at least 1." });
    await db.update(event).set({ cancelledAt: new Date() }).where(eq(event.id, id));
    await expect(add({})).rejects.toMatchObject({
      code: "invalid",
      message: "Reinstate the Event before adding to it.",
    });
  });

  it("lets the Event's dates be cleared: it holds no Stock", async () => {
    const { bea, gala: { id } } = await gala();
    await addBorrowedItem(db, bea, { eventId: id, name: "Photo booth", lender: "Lens & Co", count: 1 });

    await editEvent(db, bea, { id, name: "Gala", client: { name: "Acme" }, startsOn: "", endsOn: "" });

    expect(await loadEventScreen(db, id)).toMatchObject({ holdWindow: null, inventory: [{ name: "Photo booth" }] });
  });

  it("can have its count changed, and be removed", async () => {
    const { bea, gala: { id } } = await gala();
    const booth = await addBorrowedItem(db, bea, { eventId: id, name: "Photo booth", lender: "Lens & Co", count: 2 });
    const lights = await addBorrowedItem(db, bea, { eventId: id, name: "Uplights", lender: "Glow", count: 8 });

    await changeReserved(db, bea, { lineId: booth.id, count: 3 });
    await removeLine(db, bea, { lineId: lights.id });

    expect((await loadEventScreen(db, id))?.inventory).toMatchObject([{ name: "Photo booth", reserved: 3 }]);
  });
});
