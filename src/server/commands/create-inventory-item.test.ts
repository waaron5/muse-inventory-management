import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { item } from "@/db/schema";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { loadItemScreen } from "../loaders/item";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("createInventoryItem", () => {
  it("lets an Admin add an item with a name and Category", async () => {
    const admin = await addUser(db, { role: "admin" });

    const { id } = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "  Chalkboard  " });

    const screen = await loadItemScreen(db, id);
    expect(screen?.item).toMatchObject({
      name: "Chalkboard",
      sku: null,
      unitPriceCents: null,
      description: null,
    });
  });

  it("takes its Item Photo when it's added", async () => {
    const admin = await addUser(db, { role: "admin" });
    const photo = crypto.randomUUID();

    const { id } = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Arch", photo });

    expect((await loadItemScreen(db, id))?.item.photo).toBe(photo);
  });

  it("refuses an Item Photo already in use, and adds nothing", async () => {
    const admin = await addUser(db, { role: "admin" });
    const photo = crypto.randomUUID();
    await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Arch", photo });

    await expect(createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Second arch", photo })).rejects.toMatchObject({
      code: "invalid",
      message: "That photo is already in use. Upload it again.",
    });
    expect(await db.$count(item, eq(item.name, "Second arch"))).toBe(0);
  });

  it("keeps the SKU, Unit Price and Description it is given", async () => {
    const admin = await addUser(db, { role: "admin" });

    const { id } = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Cornhole set",
      sku: " CH-01 ",
      unitPrice: "$1,250.5",
      description: "Two boards and eight bags.",
    });

    const screen = await loadItemScreen(db, id);
    expect(screen?.item).toMatchObject({
      sku: "CH-01",
      unitPriceCents: 125050,
      description: "Two boards and eight bags.",
    });
  });

  it("treats blank optional fields as not given", async () => {
    const admin = await addUser(db, { role: "admin" });

    const { id } = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Surfboard",
      sku: "  ",
      unitPrice: "",
      description: " ",
    });

    const screen = await loadItemScreen(db, id);
    expect(screen?.item).toMatchObject({ sku: null, unitPriceCents: null, description: null });
  });

  it("records Starting Stock at its Location as Stock and History", async () => {
    const admin = await addUser(db, { role: "admin", name: "Aaron" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });

    const { id } = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Folding chair",
      startingStock: { locationId: warehouse.id, count: 18 },
    });

    const screen = await loadItemScreen(db, id);
    expect(screen?.count).toBe(18);
    expect(screen?.location).toEqual({ id: warehouse.id, name: "Warehouse" });
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date());
    expect(screen?.history).toEqual([
      expect.objectContaining({ kind: "starting-stock", count: 18, to: "Warehouse", by: "Aaron", happenedOn: today }),
    ]);
    expect(screen?.history[0].recordedAt).toBeInstanceOf(Date);
  });

  it("keeps the Location of a Starting Stock of 0, with no History", async () => {
    const admin = await addUser(db, { role: "admin" });
    const unit = await createLocation(db, admin, { name: "Unit 9" });

    const { id } = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Easel",
      startingStock: { locationId: unit.id, count: 0 },
    });

    const screen = await loadItemScreen(db, id);
    expect(screen?.count).toBe(0);
    expect(screen?.location).toEqual({ id: unit.id, name: "Unit 9" });
    expect(screen?.history).toEqual([]);
  });

  it("sits Unassigned with none when no Location is given", async () => {
    const admin = await addUser(db, { role: "admin" });

    const { id } = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Unplaced lamp" });

    const screen = await loadItemScreen(db, id);
    expect(screen?.count).toBe(0);
    expect(screen?.location?.name).toBe("Unassigned");
  });

  it("refuses a negative Starting Stock and writes nothing", async () => {
    const admin = await addUser(db, { role: "admin" });
    const shed = await createLocation(db, admin, { name: "Shed" });

    await expect(
      createInventoryItem(db, admin, {
        categoryId: testCategoryId,
        name: "Negative lamp",
        startingStock: { locationId: shed.id, count: -1 },
      }),
    ).rejects.toMatchObject({ code: "invalid", message: "Count can't be less than 0." });
  });

  it("refuses a missing Location and writes nothing", async () => {
    const admin = await addUser(db, { role: "admin" });
    const old = { id: crypto.randomUUID() };
    const before = await db.$count(item);

    await expect(
      createInventoryItem(db, admin, {
        categoryId: testCategoryId,
        name: "Ghost lamp",
        startingStock: { locationId: old.id, count: 1 },
      }),
    ).rejects.toMatchObject({ code: "invalid", message: "Pick a Location that's still in use." });
    expect(await db.$count(item)).toBe(before);
  });

  it("refuses a User and writes nothing", async () => {
    const someone = await addUser(db, { role: "user" });
    const before = await db.$count(item);

    await expect(createInventoryItem(db, someone, { categoryId: testCategoryId, name: "Sneaky lamp" })).rejects.toMatchObject({
      code: "not-allowed",
    });
    expect(await db.$count(item)).toBe(before);
  });

  it("refuses a Unit Price that isn't an amount of money", async () => {
    const admin = await addUser(db, { role: "admin" });

    await expect(
      createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Banner", unitPrice: "12.345" }),
    ).rejects.toMatchObject({ code: "invalid", message: "Enter the Unit Price as dollars and cents, like 24.99." });
  });
});
