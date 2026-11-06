import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { addAiConnection, addUser, countRoundTrips, testCategoryId, testDb } from "@/test/db";
import { deleteEvent } from "../commands/cancel-event";
import { createClient, renameClient } from "../commands/clients";
import { createEvent } from "../commands/create-event";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import { adjustStock } from "../commands/adjust-stock";
import { editEvent } from "../commands/edit-event";
import { editInventoryItem } from "../commands/edit-inventory-item";
import { giveAwayEnded } from "../commands/give-away";
import { reserve } from "../commands/reserve";
import { setOwnName } from "../commands/set-own-name";
import { deleteUser } from "../commands/users";
import { type ActivityShown, loadActivityScreen } from "./activity";

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

/** An entry's sentence as it reads, without its links. */
const read = (entry: { sentence: ActivityShown[] }) =>
  entry.sentence.map((p) => (typeof p === "string" ? p : p.name)).join("");

async function setUp() {
  const aaron = await addUser(db, { role: "admin", name: "Aaron Wood" });
  const bea = await addUser(db, { role: "user", name: "Bea" });
  const warehouse = await createLocation(db, aaron, { name: "Warehouse" });
  const garage = await createLocation(db, aaron, { name: "Garage" });
  const chairs = await createInventoryItem(db, aaron, {
    categoryId: testCategoryId,
    name: "Chairs",
    startingStock: { locationId: warehouse.id, count: 10 },
  });
  return { aaron, bea, warehouse, garage, chairs };
}

const event = { name: "Gala", client: { name: "Acme" }, startsOn: "2030-06-10", endsOn: "2030-06-12" };

describe("loadActivityScreen", () => {
  it("names the app of a change made through an AI Connection, and none for one made on screen", async () => {
    const { bea, chairs } = await setUp();
    const beasClaude = await addAiConnection(db, bea.userId, { name: "Claude" });
    const gala = await createEvent(db, beasClaude, event);
    await reserve(db, bea, { eventId: gala.id, itemId: chairs.id, count: 6 });

    const { entries } = await loadActivityScreen(db, { show: 2 });

    expect(entries.map((e) => [e.by?.name, read(e), e.viaAi])).toEqual([
      ["Bea", "reserved 6 Chairs for Gala", null],
      ["Bea", "created Gala for Acme", "Claude"],
    ]);
  });

  it("lists every change newest first, with who made it and the names as they were", async () => {
    const { aaron, bea, chairs, garage } = await setUp();
    const gala = await createEvent(db, bea, event);
    await reserve(db, bea, { eventId: gala.id, itemId: chairs.id, count: 6 });
    await editInventoryItem(db, aaron, { id: chairs.id, name: "Chairs", categoryId: testCategoryId, stock: { locationId: garage.id, count: 10, expectedCount: 10 } });

    const { entries, more } = await loadActivityScreen(db, {});

    expect(entries.map((e) => [e.by?.name, read(e)])).toEqual([
      ["Aaron Wood", "changed Chairs's Location to Garage"],
      ["Bea", "reserved 6 Chairs for Gala"],
      ["Bea", "created Gala for Acme"],
      ["Aaron Wood", "added Chairs to Inventory with 10"],
      ["Aaron Wood", "added Location Garage"],
      ["Aaron Wood", "added Location Warehouse"],
    ]);
    expect(more).toBe(false);
    expect(entries[1].sentence).toEqual([
      "reserved 6 ",
      { ref: "item", id: chairs.id, name: "Chairs", itemKind: "inventory", live: true },
      " for ",
      { ref: "event", id: gala.id, name: "Gala", live: true },
    ]);
  });

  it("keeps a name after it's changed or deleted, and stops linking what's gone", async () => {
    const { aaron, bea } = await setUp();
    const acme = await createClient(db, aaron, { name: "Acme" });
    const gala = await createEvent(db, aaron, { ...event, client: { id: acme.id } });
    await renameClient(db, aaron, { clientId: acme.id, name: "Acme Corp" });
    await deleteEvent(db, aaron, { id: gala.id });
    await deleteUser(db, aaron, { userId: bea.userId });

    const { entries } = await loadActivityScreen(db, {});

    expect(entries.slice(0, 5).map(read)).toEqual([
      "deleted Bea",
      "deleted Gala",
      "renamed Client Acme to Acme Corp",
      "created Gala for Acme",
      "added Client Acme",
    ]);
    expect(entries[3].sentence[1]).toMatchObject({ ref: "event", live: false });
  });

  it("names a deleted person by the name they had", async () => {
    const { aaron, bea } = await setUp();
    await createEvent(db, bea, event);
    await deleteUser(db, aaron, { userId: bea.userId });

    const { entries, people } = await loadActivityScreen(db, { person: bea.userId });

    expect(entries.map((e) => e.by?.name)).toEqual(["Bea"]);
    expect(people.map((p) => p.name)).toEqual(["Aaron Wood", "Bea"]);
  });

  it("filters by type and by person together", async () => {
    const { aaron, bea, chairs } = await setUp();
    const gala = await createEvent(db, bea, event);
    await reserve(db, aaron, { eventId: gala.id, itemId: chairs.id, count: 2 });
    await adjustStock(db, bea, { itemId: chairs.id, reason: "found", count: 1 });

    expect((await loadActivityScreen(db, { area: "events", person: bea.userId })).entries.map(read)).toEqual([
      "created Gala for Acme",
    ]);
    expect((await loadActivityScreen(db, { area: "stock" })).entries.map(read)).toEqual([
      "added 1 found Chairs to Warehouse",
      "added Location Garage",
      "added Location Warehouse",
    ]);
    expect((await loadActivityScreen(db, { area: "catalog", person: bea.userId })).entries).toEqual([]);
  });

  it("shows a page at a time, saying when there are more", async () => {
    await setUp();

    const page = await loadActivityScreen(db, { show: 2 });

    expect(page.entries.map(read)).toEqual(["added Chairs to Inventory with 10", "added Location Garage"]);
    expect(page.more).toBe(true);
  });

  it("lists the daily giveaway as Automatic, apart from people", async () => {
    const { aaron, bea, warehouse } = await setUp();
    const jackets = await createGift(db, aaron, { name: "Jacket", startingStock: { locationId: warehouse.id, count: 5 } });
    const ended = await createEvent(db, bea, { ...event, startsOn: "2026-01-10", endsOn: "2026-01-12" });
    await reserve(db, bea, { eventId: ended.id, itemId: jackets.id, count: 3 });
    await giveAwayEnded(db);

    const automatic = await loadActivityScreen(db, { person: "automatic" });

    expect(automatic.entries.map((e) => [e.by, read(e)])).toEqual([[null, "gave away 3 Jacket for Gala"]]);
    expect(automatic.people.at(-1)).toEqual({ id: "automatic", name: "Automatic" });
  });

  it("reads within two round trips", async () => {
    const { bea, chairs } = await setUp();
    const gala = await createEvent(db, bea, event);
    await reserve(db, bea, { eventId: gala.id, itemId: chairs.id, count: 1 });

    expect(await countRoundTrips(db, () => loadActivityScreen(db, {}))).toBeLessThanOrEqual(2);
  });
});

describe("an Activity sentence", () => {
  it("says only what an edit changed, as it is now, and nothing for an unchanged save", async () => {
    const { bea } = await setUp();
    const gala = await createEvent(db, bea, event);

    await editEvent(db, bea, { id: gala.id, ...event, startsOn: "2030-06-11", venue: "Grand Vista", notes: "Bring tape" });
    await editEvent(db, bea, { id: gala.id, ...event, startsOn: "2030-06-11", venue: "Grand Vista", notes: "Bring tape" });

    expect((await loadActivityScreen(db, { area: "events" })).entries.map(read)).toEqual([
      "changed Gala's dates to Jun 11, 2030 – Jun 12, 2030, Venue to Grand Vista and notes",
      "created Gala for Acme",
    ]);
  });

  it("says when a reservation raises one already there", async () => {
    const { bea, chairs } = await setUp();
    const gala = await createEvent(db, bea, event);
    await reserve(db, bea, { eventId: gala.id, itemId: chairs.id, count: 2 });
    await reserve(db, bea, { eventId: gala.id, itemId: chairs.id, count: 3 });

    expect(read((await loadActivityScreen(db, {})).entries[0])).toBe("reserved 3 more Chairs for Gala");
  });

  it("isn't written for a change to your own profile", async () => {
    const { bea } = await setUp();

    await setOwnName(db, bea, { name: "Beatrice" });

    expect((await loadActivityScreen(db, { person: bea.userId })).entries).toEqual([]);
  });
});
