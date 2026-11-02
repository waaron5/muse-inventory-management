import { eq } from "drizzle-orm";
import { beforeEach, expect, it } from "vitest";
import { deletedRecord, historyEntry, item, location, stock, user } from "@/db/schema";
import type { Db } from "@/db/types";
import { UNASSIGNED_LOCATION } from "@/lib/stock";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { stockOffLedger } from "@/test/ledger";
import { loadEventScreen } from "../loaders/event";
import { loadEventsScreen } from "../loaders/events";
import { loadItemScreen, loadGiftScreen } from "../loaders/item";
import { loadPrintScreen } from "../loaders/print";
import { deleteEvent } from "./cancel-event";
import { createEvent } from "./create-event";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { deleteClient, deleteItem, deleteLocation } from "./delete-record";
import { editInventoryItem } from "./edit-inventory-item";
import { giveAwayEnded } from "./give-away";
import { reserve } from "./reserve";
import { deleteUser } from "./users";

let db: Db;
let admin: Awaited<ReturnType<typeof addUser>>;
let place: { id: string };
beforeEach(async () => {
  db = await testDb();
  admin = await addUser(db, { role: "admin", name: "Judy" });
  place = await createLocation(db, admin, { name: "JP Display" });
});

const stocked = () => createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Chair", startingStock: { locationId: place.id, count: 5 } });

it("deletes an occupied Location without losing Stock or its historical name", async () => {
  const chair = await stocked();
  await deleteLocation(db, admin, { id: place.id });
  expect(await db.select().from(location).where(eq(location.id, place.id))).toEqual([]);
  const screen = (await loadItemScreen(db, chair.id))!;
  expect(screen.count).toBe(5);
  expect(screen.location).toEqual({ id: UNASSIGNED_LOCATION, name: "Unassigned" });
  expect(screen.history.some((entry) => entry.from === "JP Display")).toBe(true);
  expect(await stockOffLedger(db)).toEqual([]);
  const next = await createLocation(db, admin, { name: "Garage" });
  await editInventoryItem(db, admin, { categoryId: testCategoryId, id: chair.id, name: "Chair", stock: { locationId: next.id, count: 5, expectedCount: 5 } });
  const moved = (await loadItemScreen(db, chair.id))!;
  expect(moved.location).toEqual({ id: next.id, name: "Garage" });
  expect(moved.history[0]).toMatchObject({ kind: "transfer", count: 5, from: "Unassigned", to: "Garage" });
  expect(await stockOffLedger(db)).toEqual([]);
});

it("deletes a reserved item while keeping its Event line, print name and History", async () => {
  const chair = await stocked();
  const event = await createEvent(db, admin, { name: "Gala", client: { name: "Muse" }, startsOn: "2030-06-01" });
  await reserve(db, admin, { eventId: event.id, itemId: chair.id, count: 3 });
  await deleteItem(db, admin, { id: chair.id });
  expect(await db.select().from(item).where(eq(item.id, chair.id))).toEqual([]);
  expect(await db.select().from(stock).where(eq(stock.itemId, chair.id))).toEqual([]);
  const screen = (await loadEventScreen(db, event.id))!;
  expect(screen.inventory).toMatchObject([{ name: "Chair", reserved: 3, deleted: true, item: { kind: "inventory" } }]);
  expect(screen.shortages).toEqual([]);
  expect((await loadEventsScreen(db, {})).events[0].lines.inventory).toBe(1);
  expect((await loadPrintScreen(db, event.id))!.groups.flatMap((g) => g.rows)).toContainEqual({ name: "Chair", count: 3 });
  expect(await db.$count(historyEntry, eq(historyEntry.itemId, chair.id))).toBe(2);
  expect(await stockOffLedger(db)).toEqual([]);
});

it("deletes a Client while keeping its Events readable and searchable", async () => {
  const event = await createEvent(db, admin, { name: "Gala", client: { name: "Muse" } });
  const before = (await loadEventScreen(db, event.id))!;
  await deleteClient(db, admin, { id: before.client.id });
  expect((await loadEventScreen(db, event.id))!.client.name).toBe("Muse");
  expect((await loadEventsScreen(db, {})).events[0].client.name).toBe("Muse");
  expect((await loadPrintScreen(db, event.id))!.client.name).toBe("Muse");
});

it("deletes an Event with giveaways without restoring Gifts or losing History", async () => {
  const gift = await createGift(db, admin, { name: "Tote", startingStock: { locationId: place.id, count: 8 } });
  const event = await createEvent(db, admin, { name: "Past Gala", client: { name: "Muse" }, startsOn: "2026-01-01" });
  await reserve(db, admin, { eventId: event.id, itemId: gift.id, count: 3 });
  await giveAwayEnded(db);
  await deleteEvent(db, admin, { id: event.id });
  expect(await loadEventScreen(db, event.id)).toBeNull();
  const screen = (await loadGiftScreen(db, gift.id))!;
  expect(screen.count).toBe(5);
  expect(screen.history.find((h) => h.kind === "given-away")!.event?.name).toBe("Past Gala");
  expect(await stockOffLedger(db)).toEqual([]);
});

it("deletes user access while preserving authorship and one active Admin", async () => {
  const chair = await stocked();
  const other = await addUser(db, { role: "admin" });
  await deleteUser(db, other, { userId: admin.userId });
  expect(await db.select().from(user).where(eq(user.id, admin.userId))).toEqual([]);
  expect((await loadItemScreen(db, chair.id))!.history[0].by).toBe("Judy");
  await expect(deleteUser(db, other, { userId: other.userId })).rejects.toMatchObject({ code: "invalid" });
});

it("keeps deletion Admin-only and refuses repeated deletion", async () => {
  const chair = await stocked();
  const member = await addUser(db);
  for (const command of [deleteItem, deleteLocation, deleteClient]) {
    await expect(command(db, member, { id: chair.id })).rejects.toMatchObject({ code: "not-allowed" });
  }
  await deleteItem(db, admin, { id: chair.id });
  await expect(deleteItem(db, admin, { id: chair.id })).rejects.toMatchObject({ code: "invalid" });
  expect(await db.$count(deletedRecord, eq(deletedRecord.id, chair.id))).toBe(1);
});

it("saves stock steppers as Recounts and rolls back stale edits atomically", async () => {
  const chair = await stocked();
  await editInventoryItem(db, admin, { categoryId: testCategoryId, id: chair.id, name: "Chair", stock: { locationId: place.id, count: 7, expectedCount: 5 } });
  expect((await loadItemScreen(db, chair.id))!.count).toBe(7);
  await expect(editInventoryItem(db, admin, { categoryId: testCategoryId, id: chair.id, name: "Stale name", stock: { locationId: place.id, count: 8, expectedCount: 5 } })).rejects.toMatchObject({ code: "invalid" });
  const screen = (await loadItemScreen(db, chair.id))!;
  expect(screen.item.name).toBe("Chair");
  expect(screen.count).toBe(7);
  expect(screen.history[0]).toMatchObject({ kind: "adjustment", reason: "recount", count: 2 });
  expect(await stockOffLedger(db)).toEqual([]);
});
