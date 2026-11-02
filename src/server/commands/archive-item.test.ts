import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { loadEventScreen } from "../loaders/event";
import { loadGiftsScreen } from "../loaders/gifts";
import { loadInventoryScreen } from "../loaders/inventory";
import { loadItemScreen } from "../loaders/item";
import { adjustStock } from "./adjust-stock";
import { archiveItem, unarchiveItem } from "./archive-item";
import { cancelEvent } from "./cancel-event";
import { removeLine } from "./change-line";
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
beforeAll(async () => {
  db = await testDb();
  admin = await addUser(db, { role: "admin" });
  someone = await addUser(db, { role: "user" });
  warehouse = await createLocation(db, admin, { name: "Warehouse" });
});

const plan = (name: string, days = { startsOn: "2030-06-10", endsOn: "2030-06-12" }) =>
  createEvent(db, someone, { name, client: { name: "Acme" }, ...days });
const stocked = (name: string, count: number) =>
  createInventoryItem(db, admin, { categoryId: testCategoryId, name, startingStock: { locationId: warehouse.id, count } });
const writeOffAll = (itemId: string) =>
  adjustStock(db, admin, { itemId, reason: "recount", countedTo: 0 });

describe("archiveItem", () => {
  it("drops an item with nothing left from the catalog and the + Add picker; the Archived toggle brings it back", async () => {
    const easel = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Old easel" });
    const gala = await plan("Easel gala");

    await archiveItem(db, admin, { id: easel.id });

    expect((await loadInventoryScreen(db, {})).items.map((i) => i.name)).not.toContain("Old easel");
    expect((await loadEventScreen(db, gala.id))!.reservable.inventory.map((i) => i.name)).not.toContain("Old easel");
    expect((await loadInventoryScreen(db, { archived: true })).items.map((i) => i.name)).toContain("Old easel");
    expect((await loadItemScreen(db, easel.id))!.item.archived).toBe(true);
  });

  it("archives a Gift once none is left", async () => {
    const mug = await createGift(db, admin, { name: "Old mug", startingStock: { locationId: warehouse.id, count: 3 } });
    await adjustStock(db, someone, { itemId: mug.id, reason: "given-away", count: 3, note: "Team" });

    await archiveItem(db, admin, { id: mug.id });

    expect((await loadGiftsScreen(db, {})).items.map((i) => i.name)).not.toContain("Old mug");
  });

  it("refuses while any is in storage, and allows it once the count is adjusted to none", async () => {
    const sign = await stocked("Old sign", 4);

    await expect(archiveItem(db, admin, { id: sign.id })).rejects.toMatchObject({
      code: "invalid",
      message: "Old sign still has 4 in storage. Adjust its count to none before archiving.",
    });

    await writeOffAll(sign.id);
    await expect(archiveItem(db, admin, { id: sign.id })).resolves.toBeUndefined();
  });

  it("refuses while an Event to come reserves it, and allows it once the Line is removed", async () => {
    const arch = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Flower arch" });
    const wedding = await plan("Wedding");
    const arches = await reserve(db, someone, { eventId: wedding.id, itemId: arch.id, count: 1 });

    await expect(archiveItem(db, admin, { id: arch.id })).rejects.toMatchObject({
      code: "invalid",
      message: "Flower arch is reserved for Wedding. Remove it there before archiving.",
    });

    await removeLine(db, someone, { lineId: arches.id });
    await expect(archiveItem(db, admin, { id: arch.id })).resolves.toBeUndefined();
  });

  it("doesn't count a Reservation whose Event is over or Cancelled", async () => {
    const booth = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Photo booth" });
    const past = await plan("Last year's party", { startsOn: "2020-06-10", endsOn: "2020-06-12" });
    const fellThrough = await plan("Fell through");
    await reserve(db, someone, { eventId: past.id, itemId: booth.id, count: 1 });
    await reserve(db, someone, { eventId: fellThrough.id, itemId: booth.id, count: 1 });
    await cancelEvent(db, someone, { id: fellThrough.id });

    await expect(archiveItem(db, admin, { id: booth.id })).resolves.toBeUndefined();
  });

  it("refuses a Gift reserved until it's Given Away, however long ago its Event was", async () => {
    const pen = await createGift(db, admin, { name: "Pen" });
    const past = await plan("Old conference", { startsOn: "2020-01-10", endsOn: "2020-01-12" });
    await reserve(db, someone, { eventId: past.id, itemId: pen.id, count: 50 });

    await expect(archiveItem(db, admin, { id: pen.id })).rejects.toMatchObject({
      message: "Pen is reserved for Old conference. Remove it there before archiving.",
    });
  });

  it("archives a Gift once it's all Given Away after its Event", async () => {
    const cap = await createGift(db, admin, { name: "Cap", startingStock: { locationId: warehouse.id, count: 20 } });
    const past = await plan("Old expo", { startsOn: "2020-02-10", endsOn: "2020-02-12" });
    await reserve(db, someone, { eventId: past.id, itemId: cap.id, count: 20 });

    await giveAwayEnded(db);

    await expect(archiveItem(db, admin, { id: cap.id })).resolves.toBeUndefined();
  });

  it("refuses an item that's already Archived, or gone", async () => {
    const stool = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Old stool" });
    await archiveItem(db, admin, { id: stool.id });

    await expect(archiveItem(db, admin, { id: stool.id })).rejects.toMatchObject({
      message: "Old stool is already Archived.",
    });
    await expect(archiveItem(db, admin, { id: crypto.randomUUID() })).rejects.toMatchObject({
      message: "That item no longer exists.",
    });
  });

  it("is an Admin's to do", async () => {
    const crate = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Crate" });

    await expect(archiveItem(db, someone, { id: crate.id })).rejects.toMatchObject({ code: "not-allowed" });
  });
  it("lands no Stock on an Archived item until it's unarchived", async () => {
    const urn = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Urn" });
    await archiveItem(db, admin, { id: urn.id });

    await expect(
      adjustStock(db, admin, { itemId: urn.id, reason: "found", count: 1 }),
    ).rejects.toMatchObject({ code: "invalid", message: "Urn is Archived. Unarchive it first." });

    await unarchiveItem(db, admin, { id: urn.id });
    await adjustStock(db, admin, { itemId: urn.id, reason: "found", count: 1 });
    expect((await loadItemScreen(db, urn.id))!.count).toBe(1);
  });
});

describe("unarchiveItem", () => {
  it("brings an item back into the catalog and the + Add picker", async () => {
    const cart = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Drinks cart" });
    const gala = await plan("Cart gala");
    await archiveItem(db, admin, { id: cart.id });

    await unarchiveItem(db, admin, { id: cart.id });

    expect((await loadInventoryScreen(db, {})).items.map((i) => i.name)).toContain("Drinks cart");
    expect((await loadEventScreen(db, gala.id))!.reservable.inventory.map((i) => i.name)).toContain("Drinks cart");
  });

  it("refuses an item that isn't Archived", async () => {
    const tent = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Tent" });

    await expect(unarchiveItem(db, admin, { id: tent.id })).rejects.toMatchObject({ message: "Tent isn't Archived." });
  });

  it("is an Admin's to do", async () => {
    const rug = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Rug" });
    await archiveItem(db, admin, { id: rug.id });

    await expect(unarchiveItem(db, someone, { id: rug.id })).rejects.toMatchObject({ code: "not-allowed" });
  });
});
