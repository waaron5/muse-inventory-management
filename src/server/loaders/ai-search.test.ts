import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { client } from "@/db/schema";
import type { Db } from "@/db/types";
import { addUser, countRoundTrips, testCategoryId, testDb } from "@/test/db";
import { archiveItem } from "../commands/archive-item";
import { cancelEvent } from "../commands/cancel-event";
import { archiveClient } from "../commands/clients";
import { createEvent } from "../commands/create-event";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import { AI_SEARCH_MAX, loadAiSearch } from "./ai-search";

describe("loadAiSearch", () => {
  let db: Db;
  beforeAll(async () => {
    db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Folding chair",
      sku: "FC-20",
      startingStock: { locationId: warehouse.id, count: 40 },
    });
    await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair, white" });
    const old = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair, oak" });
    await archiveItem(db, admin, { id: old.id });
    await createGift(db, admin, { name: "Chair tote", sku: "CT-1", startingStock: { locationId: warehouse.id, count: 12 } });

    await createEvent(db, admin, {
      name: "Sales kickoff",
      client: { name: "Birchline" },
      plCode: "BRL Cove 26",
      startsOn: "2026-11-10",
      endsOn: "2026-11-12",
    });
    await createEvent(db, admin, { name: "Cove retreat", client: { name: "Ivorypeak" }, startsOn: "2025-11-10" });
    const fallen = await createEvent(db, admin, { name: "Cove offsite", client: { name: "Ivorypeak" } });
    await cancelEvent(db, admin, { id: fallen.id });
    await createEvent(db, admin, { name: "Birch Labs launch", client: { name: "Birch Labs" } });
    const [gone] = await db.select({ id: client.id }).from(client).where(eq(client.name, "Birch Labs"));
    await archiveClient(db, admin, { clientId: gone.id });
  });

  it("tells Inventory Items apart by Location, Category and Count, Archived ones last", async () => {
    const { inventory } = await loadAiSearch(db, "folding chair");

    expect(inventory.found).toEqual([
      expect.objectContaining({ name: "Folding chair", sku: "FC-20", location: "Warehouse", category: "Furniture", count: 40, archived: false }),
      expect.objectContaining({ name: "Folding chair, white", sku: null, count: 0, archived: false }),
      expect.objectContaining({ name: "Folding chair, oak", archived: true }),
    ]);
  });

  it("finds an item by its SKU, and Gifts apart from Inventory Items", async () => {
    const found = await loadAiSearch(db, "ct-1");

    expect(found.inventory.found).toEqual([]);
    expect(found.gifts.found).toEqual([expect.objectContaining({ name: "Chair tote", location: "Warehouse", count: 12 })]);
  });

  it("tells Events apart by Client and dates, Cancelled ones last", async () => {
    const { events } = await loadAiSearch(db, "cove");

    expect(events.found).toEqual([
      expect.objectContaining({ name: "Sales kickoff", client: "Birchline", plCode: "BRL Cove 26", startsOn: "2026-11-10", endsOn: "2026-11-12", cancelled: false }),
      expect.objectContaining({ name: "Cove retreat", client: "Ivorypeak", startsOn: "2025-11-10", cancelled: false }),
      expect.objectContaining({ name: "Cove offsite", cancelled: true }),
    ]);
  });

  it("finds Clients by name, Archived ones last", async () => {
    const { clients } = await loadAiSearch(db, "birch");

    expect(clients.found).toEqual([
      expect.objectContaining({ name: "Birchline", archived: false }),
      expect.objectContaining({ name: "Birch Labs", archived: true }),
    ]);
  });

  it("says when there are more matches than it lists", async () => {
    const admin = await addUser(db, { role: "admin" });
    for (let i = 0; i <= AI_SEARCH_MAX; i++) await createGift(db, admin, { name: `Notebook ${i}` });

    const { gifts } = await loadAiSearch(db, "notebook");

    expect(gifts.found).toHaveLength(AI_SEARCH_MAX);
    expect(gifts.more).toBe(true);
    expect((await loadAiSearch(db, "chair tote")).gifts.more).toBe(false);
  });

  it("takes a search term literally, and finds nothing for a blank one", async () => {
    const nothing = { found: [], more: false };
    const none = { inventory: nothing, gifts: nothing, events: nothing, clients: nothing };

    expect(await loadAiSearch(db, "%")).toEqual(none);
    expect(await loadAiSearch(db, "  ")).toEqual(none);
  });

  it("stays within one round trip", async () => {
    expect(await countRoundTrips(db, () => loadAiSearch(db, "c"))).toBe(1);
  });
});
