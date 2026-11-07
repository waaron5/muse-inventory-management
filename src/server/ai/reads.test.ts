import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { client as clientTable } from "@/db/schema";
import type { Db } from "@/db/types";
import { todayInMuse } from "@/lib/time-zone";
import { addAiConnection, addUser, testCategoryId, testDb } from "@/test/db";
import { addBorrowedItem } from "../commands/add-line";
import { archiveItem } from "../commands/archive-item";
import { cancelEvent } from "../commands/cancel-event";
import { createEvent } from "../commands/create-event";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import { reserve } from "../commands/reserve";
import { loadActivityScreen } from "../loaders/activity";
import { loadCategoriesScreen } from "../loaders/categories";
import { loadEventScreen } from "../loaders/event";
import { loadEventsScreen } from "../loaders/events";
import { loadItemScreen } from "../loaders/item";
import { loadLocationsScreen } from "../loaders/locations";
import { mcpServer } from "./mcp-server";
import { DATES } from "./reads";

const APP = "https://inventory.museem.com";

describe("an AI Connection's reads", () => {
  let db: Db;
  let ai: Client;
  let chairs: { id: string };
  let totes: { id: string };
  let cove: { id: string };
  let Birchline: string;

  beforeAll(async () => {
    db = await testDb();
    const admin = await addUser(db, { role: "admin", name: "Quinn" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    chairs = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Folding chair",
      sku: "FC-20",
      unitPrice: "12.50",
      startingStock: { locationId: warehouse.id, count: 10 },
    });
    const old = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Oak chair" });
    await archiveItem(db, admin, { id: old.id });
    totes = await createGift(db, admin, { name: "Tote", startingStock: { locationId: warehouse.id, count: 20 } });

    cove = await createEvent(db, admin, {
      name: "Cove",
      client: { name: "Birchline" },
      plCode: "BRL Cove 26",
      venue: "One&Only",
      startsOn: "2027-05-03",
      endsOn: "2027-05-05",
    });
    const rival = await createEvent(db, admin, { name: "Rival", client: { name: "Ivorypeak" }, startsOn: "2027-05-04" });
    await createEvent(db, admin, { name: "Last year", client: { name: "Birchline" }, startsOn: "2025-05-03" });
    const fallen = await createEvent(db, admin, { name: "Fell through", client: { name: "Birchline" }, startsOn: "2027-06-01" });
    await cancelEvent(db, admin, { id: fallen.id });
    await reserve(db, admin, { eventId: cove.id, itemId: chairs.id, count: 6 });
    await reserve(db, admin, { eventId: rival.id, itemId: chairs.id, count: 7 });
    await reserve(db, admin, { eventId: cove.id, itemId: totes.id, count: 8 });
    await addBorrowedItem(db, admin, { eventId: cove.id, name: "Photo booth", lender: "Lighthouse AV", count: 1 });
    [{ id: Birchline }] = await db.select({ id: clientTable.id }).from(clientTable).where(eq(clientTable.name, "Birchline"));

    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const { aiTokenId } = await addAiConnection(db, admin.userId);
    const connection = { userId: admin.userId, name: "Quinn", email: "quinn@museem.com", role: "admin" as const, clientId: "", appName: "Claude", aiTokenId };
    await mcpServer({ db, appURL: APP, connection, sendInvite: async () => "emailed", sendBugMail: async () => true }).connect(serverSide);
    ai = new Client({ name: "test", version: "1.0.0" });
    await ai.connect(clientSide);
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await ai.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return result.isError ? { refused: text } : JSON.parse(text);
  }

  it("marks every read read-only, and says how dates are written wherever there are dates", async () => {
    const { tools } = await ai.listTools();

    expect(tools.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name).sort()).toEqual([
      "activity", "availability", "categories", "event", "events", "item", "locations", "search",
    ]);
    for (const name of ["item", "availability", "events", "event", "activity"]) {
      expect(tools.find((t) => t.name === name)?.description).toContain(DATES);
    }
  });

  it("item: answers as the item's page does, with a link", async () => {
    const answer = await call("item", { id: chairs.id });
    const screen = (await loadItemScreen(db, chairs.id))!;

    expect(answer).toMatchObject({
      kind: "inventory",
      name: "Folding chair",
      sku: "FC-20",
      unitPrice: "$12.50",
      category: "Furniture",
      count: screen.count,
      location: "Warehouse",
      archived: false,
      link: `${APP}/inventory/${chairs.id}`,
    });
    expect(answer.reservedFor).toEqual(
      screen.upcoming.map((u) => ({ event: { ...u.event, link: `${APP}/events/${u.event.id}` }, reserved: u.reserved, shortBy: u.shortBy })),
    );
    expect(answer.reservedFor.map((r: { shortBy: number }) => r.shortBy)).toEqual([3, 3]);
    expect(answer.recentHistory).toEqual([expect.objectContaining({ kind: "starting-stock", count: 10, to: "Warehouse", by: "Quinn", happenedOn: todayInMuse() })]);
  });

  it("item: finds a Gift too, linking to its Gift page", async () => {
    expect(await call("item", { id: totes.id })).toMatchObject({ kind: "gift", count: 20, link: `${APP}/gifts/${totes.id}` });
    expect(await call("item", { id: cove.id })).toEqual({ refused: expect.stringContaining("Search for it first") });
  });

  it("availability: answers over an Event's Hold Window with its Shortage, and over given dates", async () => {
    const overCabo = await call("availability", { itemIds: [chairs.id, totes.id], eventId: cove.id });
    const screen = (await loadEventScreen(db, cove.id))!;

    expect(overCabo.over).toMatchObject({ event: { name: "Cove", link: `${APP}/events/${cove.id}` }, from: "2027-05-03", to: "2027-05-05" });
    expect(overCabo.items).toEqual([
      expect.objectContaining({
        name: "Folding chair",
        available: screen.reservable.inventory.find((i) => i.id === chairs.id)!.available,
        reservedForEvent: 6,
        shortage: expect.objectContaining({ shortBy: 3, flagged: true }),
        heldBy: [{ event: expect.objectContaining({ name: "Rival", link: expect.stringContaining("/events/") }), reserved: 7 }],
        link: `${APP}/inventory/${chairs.id}`,
      }),
      expect.objectContaining({ name: "Tote", available: 20, reservedForEvent: 8, link: `${APP}/gifts/${totes.id}` }),
    ]);

    const overDays = await call("availability", { itemIds: [chairs.id], from: "2027-05-05", to: "2027-05-06" });
    expect(overDays.items).toEqual([expect.objectContaining({ available: 4, shortBy: null })]);
  });

  it("availability: refuses a question that names both or neither", async () => {
    expect(await call("availability", { itemIds: [chairs.id] })).toEqual({ refused: expect.stringContaining("dates") });
    expect(await call("availability", { categoryId: testCategoryId, itemIds: [chairs.id], from: "2027-05-05" })).toEqual({
      refused: expect.stringContaining("itemIds or categoryId"),
    });
  });

  it("availability: leaves Archived items out of a Category unless asked for", async () => {
    const names = async (args: Record<string, unknown>) =>
      (await call("availability", { categoryId: testCategoryId, from: "2027-05-05", ...args })).items.map((i: { name: string }) => i.name);

    expect(await names({})).toEqual(["Folding chair"]);
    expect(await names({ includeArchived: true })).toEqual(["Folding chair", "Oak chair"]);
  });

  it("events: lists what the Events list shows, by status, Client and month", async () => {
    const upcoming = await call("events");
    const screen = await loadEventsScreen(db, {});

    expect(upcoming.events.map((e: { id: string }) => e.id)).toEqual(screen.events.map((e) => e.id));
    expect(upcoming.counts).toEqual(screen.counts);
    expect(upcoming.events[0]).toMatchObject({
      name: "Cove",
      client: "Birchline",
      plCode: "BRL Cove 26",
      lines: { inventory: 2, gifts: 1 },
      shortBy: 3,
      link: `${APP}/events/${cove.id}`,
    });

    const narrowed = await call("events", { status: "past", clientId: Birchline, month: "2025-05" });
    expect(narrowed.events.map((e: { name: string }) => e.name)).toEqual(["Last year"]);
    expect(narrowed.link).toBe(`${APP}/events?tab=past&client=${Birchline}&month=2025-05`);
    expect((await call("events", { status: "cancelled" })).events.map((e: { name: string }) => e.name)).toEqual(["Fell through"]);
  });

  it("event: gives its Lines, who added each, and its Shortages, as its page does", async () => {
    const answer = await call("event", { id: cove.id });
    const screen = (await loadEventScreen(db, cove.id))!;

    expect(answer).toMatchObject({ name: "Cove", client: { name: "Birchline", link: `${APP}/events?client=${Birchline}` }, plCode: "BRL Cove 26", venue: "One&Only" });
    expect(answer.inventory.map((l: { name: string; reserved: number }) => [l.name, l.reserved])).toEqual(screen.inventory.map((l) => [l.name, l.reserved]));
    expect(answer.inventory).toEqual([
      expect.objectContaining({ name: "Folding chair", kind: "reservation", item: expect.objectContaining({ unitPrice: "$12.50" }), addedBy: { name: "Quinn", on: todayInMuse() } }),
      expect.objectContaining({ name: "Photo booth", kind: "borrowed", item: null, lender: "Lighthouse AV" }),
    ]);
    expect(answer.gifts).toEqual([expect.objectContaining({ name: "Tote", reserved: 8, item: expect.objectContaining({ link: `${APP}/gifts/${totes.id}` }) })]);
    expect(answer.shortages).toEqual([
      expect.objectContaining({ item: { id: chairs.id, name: "Folding chair", link: `${APP}/inventory/${chairs.id}` }, shortBy: 3, flagged: true, competing: [expect.objectContaining({ reserved: 7 })] }),
    ]);
    expect(answer.reservedValue).toBe("$75");
  });

  it("activity: gives the newest first, as the Activity page does", async () => {
    const answer = await call("activity", { limit: 5 });
    const screen = await loadActivityScreen(db, { show: 5 });

    expect(answer.entries).toHaveLength(5);
    expect(answer.more).toBe(true);
    expect(answer.entries.map((e: { did: string }) => e.did)).toEqual(
      screen.entries.map((e) => e.sentence.map((p) => (typeof p === "string" ? p : p.name)).join("")),
    );
    expect(answer.entries[0]).toMatchObject({ by: "Quinn", day: todayInMuse(), did: expect.stringContaining("Photo booth") });
    expect(answer.entries.find((e: { did: string }) => e.did.includes("Tote"))?.mentions).toContainEqual({ kind: "item", name: "Tote", link: `${APP}/gifts/${totes.id}` });
  });

  it("locations and categories: the reference lists, as Settings shows them", async () => {
    const { locations } = await loadLocationsScreen(db);
    const { categories } = await loadCategoriesScreen(db);

    expect((await call("locations")).locations).toEqual(locations.map((l) => ({ id: l.id, name: l.name, stock: l.holds })));
    expect(await call("categories")).toEqual({ categories, link: `${APP}/settings#categories` });
  });
});
