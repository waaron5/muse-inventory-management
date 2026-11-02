import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { stockOffLedger } from "@/test/ledger";
import { loadGiftScreen, loadItemScreen } from "../loaders/item";
import { adjustStock } from "./adjust-stock";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

async function chairsInWarehouse(count: number) {
  const admin = await addUser(db, { role: "admin", name: "Aaron" });
  const warehouse = await createLocation(db, admin, { name: "Warehouse" });
  const item = await createInventoryItem(db, admin, {
    categoryId: testCategoryId,
    name: "Folding chair",
    startingStock: { locationId: warehouse.id, count },
  });
  return { admin, item, warehouse };
}

describe("adjustStock", () => {
  it("lets a User record Found, with a note", async () => {
    const { item } = await chairsInWarehouse(6);
    const someone = await addUser(db, { role: "user", name: "Bea" });

    await adjustStock(db, someone, {
      itemId: item.id,
      reason: "found",
      count: 2,
      note: "Behind the pallet rack",
    });

    const screen = await loadItemScreen(db, item.id);
    expect(screen?.count).toBe(8);
    expect(screen?.history[0]).toMatchObject({
      kind: "adjustment",
      reason: "found",
      count: 2,
      from: null,
      to: "Warehouse",
      by: "Bea",
      note: "Behind the pallet rack",
    });
    expect(await stockOffLedger(db)).toEqual([]);
  });

  it("refuses a User recording Purchased and changes nothing", async () => {
    const { item } = await chairsInWarehouse(6);
    const someone = await addUser(db, { role: "user" });

    await expect(
      adjustStock(db, someone, { itemId: item.id, reason: "purchased", count: 10 }),
    ).rejects.toMatchObject({ code: "not-allowed", message: "Only an Admin can do this." });
    const screen = await loadItemScreen(db, item.id);
    expect(screen?.count).toBe(6);
    expect(screen?.history).toHaveLength(1);
  });

  it("lets an Admin record Purchased", async () => {
    const { admin, item } = await chairsInWarehouse(6);

    await adjustStock(db, admin, { itemId: item.id, reason: "purchased", count: 10 });

    const screen = await loadItemScreen(db, item.id);
    expect(screen?.count).toBe(16);
    expect(screen?.history[0]).toMatchObject({ kind: "adjustment", reason: "purchased", count: 10, to: "Warehouse" });
  });

  it("takes Lost stock from the Location", async () => {
    const { admin, item } = await chairsInWarehouse(6);

    await adjustStock(db, admin, { itemId: item.id, reason: "lost", count: 2 });

    const screen = await loadItemScreen(db, item.id);
    expect(screen?.count).toBe(4);
    expect(screen?.history[0]).toMatchObject({ reason: "lost", count: 2, from: "Warehouse", to: null });
    expect(await stockOffLedger(db)).toEqual([]);
  });

  it("keeps both the earlier day it happened and when it was recorded", async () => {
    const { admin, item } = await chairsInWarehouse(6);

    await adjustStock(db, admin, {
      itemId: item.id,
      reason: "damaged",
      count: 1,
      happenedOn: "2026-09-30",
    });

    const [entry] = (await loadItemScreen(db, item.id))?.history.filter((e) => e.kind === "adjustment") ?? [];
    expect(entry).toMatchObject({ happenedOn: "2026-09-30", recordedAt: expect.any(Date) });
    expect(entry.recordedAt > new Date("2026-09-30T23:59:59-06:00")).toBe(true);
  });

  it("records a Recount as the difference from what was there", async () => {
    const { admin, item } = await chairsInWarehouse(6);

    await adjustStock(db, admin, { itemId: item.id, reason: "recount", countedTo: 9 });
    await adjustStock(db, admin, { itemId: item.id, reason: "recount", countedTo: 0 });

    const screen = await loadItemScreen(db, item.id);
    expect(screen?.count).toBe(0);
    expect(screen?.history.slice(0, 2)).toEqual([
      expect.objectContaining({ reason: "recount", count: 9, from: "Warehouse", to: null }),
      expect.objectContaining({ reason: "recount", count: 3, from: null, to: "Warehouse" }),
    ]);
    expect(await stockOffLedger(db)).toEqual([]);
  });

  it("refuses a Recount that matches what's there", async () => {
    const { admin, item } = await chairsInWarehouse(6);

    await expect(
      adjustStock(db, admin, { itemId: item.id, reason: "recount", countedTo: 6 }),
    ).rejects.toMatchObject({ code: "invalid", message: "Warehouse already has 6." });
  });

  it("refuses to take a Location below zero, even when two run at once", async () => {
    const { admin, item } = await chairsInWarehouse(6);
    const writeOff = () =>
      adjustStock(db, admin, { itemId: item.id, reason: "damaged", count: 4 });

    const results = await Promise.allSettled([writeOff(), writeOff()]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "invalid", message: "There are only 2 at Warehouse." },
    });
    expect((await loadItemScreen(db, item.id))?.count).toBe(2);
    expect(await stockOffLedger(db)).toEqual([]);
  });
});

describe("adjustStock: Given away", () => {
  async function jacketsInWarehouse(count: number) {
    const admin = await addUser(db, { role: "admin" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    const gift = await createGift(db, admin, {
      name: "Nano Puff jacket – M",
      startingStock: { locationId: warehouse.id, count },
    });
    return { gift, warehouse };
  }

  it("lets a User give a Gift away, noting who it went to", async () => {
    const { gift } = await jacketsInWarehouse(12);
    const someone = await addUser(db, { role: "user", name: "Bea" });

    await adjustStock(db, someone, {
      itemId: gift.id,
      reason: "given-away",
      count: 2,
      note: "Ivorypeak's CEO and CFO",
    });

    const screen = await loadGiftScreen(db, gift.id);
    expect(screen?.count).toBe(10);
    expect(screen?.history[0]).toMatchObject({
      kind: "adjustment",
      reason: "given-away",
      count: 2,
      from: "Warehouse",
      to: null,
      by: "Bea",
      note: "Ivorypeak's CEO and CFO",
    });
    expect(await stockOffLedger(db)).toEqual([]);
  });

  it("refuses it without a note of who it went to", async () => {
    const { gift } = await jacketsInWarehouse(12);

    await expect(
      adjustStock(db, await addUser(db), {
        itemId: gift.id,
        reason: "given-away",
        count: 2,
        note: "  ",
      }),
    ).rejects.toMatchObject({ code: "invalid", message: "Note who it went to." });
    expect((await loadGiftScreen(db, gift.id))?.count).toBe(12);
  });

  it("refuses it for an Inventory Item", async () => {
    const { admin, item } = await chairsInWarehouse(6);

    await expect(
      adjustStock(db, admin, {
        itemId: item.id,
        reason: "given-away",
        count: 1,
        note: "A client",
      }),
    ).rejects.toMatchObject({ code: "invalid", message: "Only a Gift can be given away." });
    expect((await loadItemScreen(db, item.id))?.count).toBe(6);
  });

  it("refuses to give away more than a Location holds", async () => {
    const { gift } = await jacketsInWarehouse(2);

    await expect(
      adjustStock(db, await addUser(db), {
        itemId: gift.id,
        reason: "given-away",
        count: 3,
        note: "Three speakers",
      }),
    ).rejects.toMatchObject({ code: "invalid", message: "There are only 2 at Warehouse." });
  });
});
