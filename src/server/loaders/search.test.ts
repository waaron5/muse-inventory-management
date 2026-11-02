import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, countRoundTrips, testDb } from "@/test/db";
import { archiveItem } from "../commands/archive-item";
import { cancelEvent } from "../commands/cancel-event";
import { createEvent } from "../commands/create-event";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { loadSearch } from "./search";

describe("loadSearch", () => {
  let db: Db;
  beforeAll(async () => {
    db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    await createEvent(db, admin, {
      name: "Sales kickoff",
      client: { name: "Birchline" },
      plCode: "BRL Cove 26",
      venue: "Grand Vista",
      startsOn: "2026-11-10",
      endsOn: "2026-11-12",
    });
    await createEvent(db, admin, { name: "Cove retreat", client: { name: "Ivorypeak" }, startsOn: "2025-11-10" });
    const fallen = await createEvent(db, admin, { name: "Cove offsite", client: { name: "Ivorypeak" } });
    await cancelEvent(db, admin, { id: fallen.id });
    await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair", sku: "FC-20" });
    await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Chalkboard" });
    const banner = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Chalk banner", sku: "FC-99" });
    await archiveItem(db, admin, { id: banner.id });
    await createGift(db, admin, { name: "Chalkboard tote", sku: "CT-1" });
  });

  it("finds an Event by its P&L Code, Name, Client or Venue", async () => {
    const found = async (q: string) => (await loadSearch(db, q)).events.map((e) => e.name);

    expect(await found("brl cove")).toEqual(["Sales kickoff"]);
    expect(await found("kickoff")).toEqual(["Sales kickoff"]);
    expect(await found("birch")).toEqual(["Sales kickoff"]);
    expect(await found("vista")).toEqual(["Sales kickoff"]);
  });

  it("shows each Event's Client, dates and whether it was Cancelled, Cancelled ones last", async () => {
    const { events } = await loadSearch(db, "cove");

    expect(events).toEqual([
      expect.objectContaining({ name: "Sales kickoff", clientName: "Birchline", startsOn: "2026-11-10", endsOn: "2026-11-12", cancelled: false }),
      expect.objectContaining({ name: "Cove retreat", clientName: "Ivorypeak", startsOn: "2025-11-10", cancelled: false }),
      expect.objectContaining({ name: "Cove offsite", cancelled: true }),
    ]);
  });

  it("finds an Inventory Item or Gift by its SKU or Name, apart", async () => {
    expect(await loadSearch(db, "fc-20")).toMatchObject({ inventory: [{ name: "Folding chair", sku: "FC-20" }], gifts: [] });
    expect(await loadSearch(db, "chalkboard")).toMatchObject({
      inventory: [{ name: "Chalkboard" }],
      gifts: [{ name: "Chalkboard tote", sku: "CT-1" }],
    });
  });

  it("leaves Archived items out", async () => {
    const { inventory } = await loadSearch(db, "chalk");

    expect(inventory.map((i) => i.name)).toEqual(["Chalkboard"]);
  });

  it("takes a search term literally", async () => {
    expect(await loadSearch(db, "%")).toEqual({ events: [], inventory: [], gifts: [] });
  });

  it("finds nothing for a blank search, without asking the database", async () => {
    expect(await countRoundTrips(db, async () => expect(await loadSearch(db, "  ")).toEqual({ events: [], inventory: [], gifts: [] }))).toBe(0);
  });

  it("stays within one round trip", async () => {
    expect(await countRoundTrips(db, () => loadSearch(db, "c"))).toBe(1);
  });
});
