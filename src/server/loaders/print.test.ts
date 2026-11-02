import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, countRoundTrips, testDb } from "@/test/db";
import { addBorrowedItem } from "../commands/add-line";
import { createEvent } from "../commands/create-event";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import { reserve } from "../commands/reserve";
import { loadPrintScreen } from "./print";

describe("loadPrintScreen", () => {
  let db: Db;
  let bea: Awaited<ReturnType<typeof addUser>>;
  let admin: Awaited<ReturnType<typeof addUser>>;
  let places: Record<"Warehouse" | "Garage" | "Shed", { id: string }>;
  let items: Record<"chairs" | "tables" | "jackets", { id: string }>;
  beforeAll(async () => {
    db = await testDb();
    admin = await addUser(db, { role: "admin", name: "Aaron" });
    bea = await addUser(db, { role: "user", name: "Bea" });
    places = {
      Warehouse: await createLocation(db, admin, { name: "Warehouse" }),
      Garage: await createLocation(db, admin, { name: "Garage" }),
      Shed: await createLocation(db, admin, { name: "Shed" }),
    };
    items = {
      chairs: await createInventoryItem(db, admin, {
        categoryId: testCategoryId,
        name: "Folding chair",
        startingStock: { locationId: places.Garage.id, count: 13 },
      }),
      tables: await createInventoryItem(db, admin, {
        categoryId: testCategoryId,
        name: "Cocktail table",
        startingStock: { locationId: places.Shed.id, count: 3 },
      }),
      jackets: await createGift(db, admin, {
        name: "Jacket",
        startingStock: { locationId: places.Shed.id, count: 5 },
      }),
    };
  });

  // An Event needing chairs, tables, jackets and something borrowed.
  async function gala() {
    const found = await createEvent(db, bea, {
      name: "Gala",
      client: { name: "Acme" },
      startsOn: "2030-06-10",
    });
    const lines = {
      chairs: await reserve(db, bea, { eventId: found.id, itemId: items.chairs.id, count: 10 }),
      tables: await reserve(db, bea, { eventId: found.id, itemId: items.tables.id, count: 2 }),
      jackets: await reserve(db, bea, { eventId: found.id, itemId: items.jackets.id, count: 5 }),
      booth: await addBorrowedItem(db, bea, { eventId: found.id, name: "Photo booth", lender: "Pinnacle Rentals", count: 1 }),
    };
    return { ...found, lines };
  }

  it("finds nothing for an Event that isn't there", async () => {
    expect(await loadPrintScreen(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await loadPrintScreen(db, "not-an-event")).toBeNull();
  });

  it("lists everything the Event needs under each item's Location, then lenders", async () => {
    const { id } = await gala();
    const list = await loadPrintScreen(db, id);

    expect(list).toMatchObject({ name: "Gala", client: { name: "Acme" } });
    // Inventory and Gifts share one list.
    expect(list?.groups).toEqual([
      { heading: "Garage", rows: [{ name: "Folding chair", count: 10 }] },
      {
        heading: "Shed",
        rows: [
          { name: "Cocktail table", count: 2 },
          { name: "Jacket", count: 5 },
        ],
      },
      { heading: "Pinnacle Rentals", rows: [{ name: "Photo booth", count: 1 }] },
    ]);
  });

  it("lists what there's no Stock for under Not in stock", async () => {
    const found = await createEvent(db, bea, { name: "Short gala", client: { name: "Acme" }, startsOn: "2030-07-01" });
    const lamps = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Lamp" });
    await reserve(db, bea, { eventId: found.id, itemId: items.tables.id, count: 5 });
    await reserve(db, bea, { eventId: found.id, itemId: lamps.id, count: 2 });

    expect((await loadPrintScreen(db, found.id))?.groups).toEqual([
      { heading: "Shed", rows: [{ name: "Cocktail table", count: 3 }] },
      {
        heading: "Not in stock",
        rows: [
          { name: "Cocktail table", count: 2 },
          { name: "Lamp", count: 2 },
        ],
      },
    ]);
  });

  it("lists A–Z as one list with no Location headings, each item's counts added up", async () => {
    const { id } = await gala();

    expect((await loadPrintScreen(db, id, "a-z"))?.groups).toEqual([
      {
        heading: null,
        rows: [
          { name: "Cocktail table", count: 2 },
          { name: "Folding chair", count: 10 },
          { name: "Jacket", count: 5 },
        ],
      },
      { heading: "Pinnacle Rentals", rows: [{ name: "Photo booth", count: 1 }] },
    ]);
  });

  it("takes one round trip", async () => {
    const { id } = await gala();
    expect(await countRoundTrips(db, () => loadPrintScreen(db, id))).toBe(1);
  });
});
