import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { desc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { activity, event, item, stock } from "@/db/schema";
import type { Db } from "@/db/types";
import { addAiConnection, addUser, testCategoryId, testDb } from "@/test/db";
import { allCommands } from "../commands/all";
import { createEvent } from "../commands/create-event";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import type { AiConnection } from "./connection";
import { mcpServer } from "./mcp-server";

const APP = "https://inventory.museem.com";

describe("an AI Connection's changes", () => {
  let db: Db;
  let invited: string[];
  let warehouse: { id: string };
  let annex: { id: string };
  let cove: { id: string };
  let chairs: { id: string };
  let quinnsClaude: Client;
  let robinsChatGPT: Client;

  // The person and their app, as `/mcp` finds them for a call.
  async function connectAs(role: "admin" | "user", name: string, appName: string) {
    const person = await addUser(db, { role, name });
    const { aiTokenId, clientId } = await addAiConnection(db, person.userId, { name: appName });
    const connection: AiConnection = { userId: person.userId, name, email: `${name.toLowerCase()}@museem.com`, role, clientId, appName, aiTokenId };
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await mcpServer({ db, appURL: APP, connection, sendInvite: async (to) => (invited.push(to), "emailed"), sendBugMail: async () => true }).connect(serverSide);
    const ai = new Client({ name: appName, version: "1.0.0" });
    await ai.connect(clientSide);
    return { ai, person };
  }

  beforeAll(async () => {
    db = await testDb();
    invited = [];
    const admin = await addUser(db, { role: "admin", name: "Sam" });
    warehouse = await createLocation(db, admin, { name: "Warehouse" });
    annex = await createLocation(db, admin, { name: "Annex" });
    chairs = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Folding chair",
      sku: "FC-20",
      unitPrice: "12.50",
      description: "Grey, stacks",
      startingStock: { locationId: warehouse.id, count: 10 },
    });
    cove = await createEvent(db, admin, {
      name: "Cove",
      client: { name: "Birchline" },
      plCode: "BRL Cove 26",
      venue: "One&Only",
      notes: "Beach set-up",
      startsOn: "2027-05-03",
      endsOn: "2027-05-05",
    });
    ({ ai: quinnsClaude } = await connectAs("admin", "Quinn", "Claude"));
    ({ ai: robinsChatGPT } = await connectAs("user", "Robin", "ChatGPT"));
  });

  async function call(ai: Client, name: string, args: Record<string, unknown> = {}) {
    const result = await ai.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0].text;
    return result.isError ? { refused: text } : JSON.parse(text);
  }

  it("offers every command but the excluded ones, each described, none marked read-only", async () => {
    const { tools } = await quinnsClaude.listTools();
    const offered = new Map(tools.map((t) => [t.name, t]));
    for (const [name, command] of Object.entries(allCommands)) {
      const { ai } = command.spec;
      if (ai === false) {
        expect(offered.has(name), `${name} is excluded`).toBe(false);
        continue;
      }
      const tool = offered.get(name);
      expect(tool, `${name} is available`).toBeDefined();
      expect(tool!.description).toBe(ai.description);
      expect(tool!.inputSchema.type).toBe("object");
      expect(tool!.annotations?.readOnlyHint).toBe(false);
    }
    // And the reads.
    expect(offered.get("search")?.annotations?.readOnlyHint).toBe(true);
  });

  it("reserves as its person, says what changed with links, and reports the Shortage it caused", async () => {
    const reserved = await call(quinnsClaude, "reserve", { eventId: cove.id, itemId: chairs.id, count: 12 });

    expect(reserved).toMatchObject({
      done: "Quinn reserved 12 Folding chair for Cove",
      mentions: [
        { kind: "item", name: "Folding chair", link: `${APP}/inventory/${chairs.id}` },
        { kind: "event", name: "Cove", link: `${APP}/events/${cove.id}` },
      ],
      shortages: [{ item: { id: chairs.id, name: "Folding chair", link: `${APP}/inventory/${chairs.id}` }, event: { name: "Cove", link: `${APP}/events/${cove.id}` }, shortBy: 2 }],
    });
    expect(reserved.result.id).toEqual(expect.any(String));
    const [entry] = await db.select().from(activity).orderBy(desc(activity.recordedAt)).limit(1);
    expect(entry).toMatchObject({ sentence: [expect.anything(), expect.anything(), " for ", expect.anything()], viaAiApp: "Claude" });
  });

  it("reports only the Shortages of what it changed, not others already on the Event", async () => {
    const lamps = await call(quinnsClaude, "createInventoryItem", {
      name: "Floor lamp",
      categoryId: testCategoryId,
      startingStock: { locationId: warehouse.id, count: 5 },
    });

    const reserved = await call(quinnsClaude, "reserve", { eventId: cove.id, itemId: lamps.result.id, count: 3 });

    expect(reserved.done).toBe("Quinn reserved 3 Floor lamp for Cove");
    expect(reserved.shortages).toBeUndefined();
    expect((await call(quinnsClaude, "event", { id: cove.id })).shortages).toHaveLength(1);
    const lamp = (await call(quinnsClaude, "event", { id: cove.id })).inventory.find((l: { name: string }) => l.name === "Floor lamp");
    await call(quinnsClaude, "removeLine", { lineId: lamp.lineId });
  });

  it("changes and removes a Line by the lineId the event tool gives", async () => {
    const { inventory } = await call(quinnsClaude, "event", { id: cove.id });
    const { lineId } = inventory.find((l: { name: string }) => l.name === "Folding chair");

    expect(await call(quinnsClaude, "changeReserved", { lineId, count: 8 })).toMatchObject({ done: "Quinn changed Folding chair on Cove to 8" });
    expect((await call(quinnsClaude, "event", { id: cove.id })).shortages).toEqual([]);
    expect(await call(robinsChatGPT, "removeLine", { lineId })).toMatchObject({ done: "Robin removed Folding chair from Cove" });
    expect((await call(quinnsClaude, "event", { id: cove.id })).inventory).toEqual([]);
  });

  it("returns the command's own message when it refuses", async () => {
    expect(await call(quinnsClaude, "reserve", { eventId: cove.id, itemId: chairs.id, count: 0 })).toEqual({ refused: "Reserve at least 1." });
    expect(await call(quinnsClaude, "createEvent", { name: "Rival", client: { name: "Acme" }, plCode: "BRL Cove 26" })).toEqual({
      refused: "Another Event already has the P&L Code BRL Cove 26.",
    });
  });

  it("refuses a User's AI what only an Admin can do, as on screen, and lets an Admin's invite", async () => {
    expect(await call(robinsChatGPT, "createInventoryItem", { name: "Bar stool", categoryId: testCategoryId })).toEqual({
      refused: "Only an Admin can do this.",
    });
    expect(await call(robinsChatGPT, "inviteUser", { email: "kit@museem.com" })).toEqual({ refused: "Only an Admin can do this." });
    expect(invited).toEqual([]);

    expect(await call(quinnsClaude, "inviteUser", { email: "Kit@museem.com" })).toMatchObject({
      done: "Quinn invited kit@museem.com",
      email: "Emailed them how to sign in.",
    });
    expect(invited).toEqual(["kit@museem.com"]);
  });

  it("lets anyone's AI do what anyone can, as them", async () => {
    const added = await call(robinsChatGPT, "createLocation", { name: "Storage unit" });

    expect(added).toMatchObject({ done: "Robin added Location Storage unit" });
    const [entry] = await db.select().from(activity).orderBy(desc(activity.recordedAt)).limit(1);
    expect(entry.viaAiApp).toBe("ChatGPT");
  });

  it("adds an item from Unit Price as typed, never with a photo", async () => {
    const added = await call(quinnsClaude, "createInventoryItem", {
      name: "Bar stool",
      categoryId: testCategoryId,
      unitPrice: "$1,250",
      startingStock: { locationId: annex.id, count: 4 },
      photo: "6f1e7c1a-5b8e-4a55-9a40-0d3c9f4a1b2c",
    });

    const [stool] = await db.select().from(item).where(eq(item.id, added.result.id));
    expect(stool).toMatchObject({ name: "Bar stool", unitPriceCents: 125000, photo: null });
    expect(added.mentions[0].link).toBe(`${APP}/inventory/${stool.id}`);
  });

  it("edits an Event's given fields only, keeping the rest", async () => {
    const edited = await call(quinnsClaude, "editEvent", { id: cove.id, venue: "Las Ventanas" });

    expect(edited.done).toBe("Quinn changed Cove's Venue to Las Ventanas");
    const [now] = await db.select().from(event).where(eq(event.id, cove.id));
    expect(now).toMatchObject({ name: "Cove", plCode: "BRL Cove 26", venue: "Las Ventanas", notes: "Beach set-up", startsOn: "2027-05-03", endsOn: "2027-05-05" });

    await call(quinnsClaude, "editEvent", { id: cove.id, notes: "" });
    const [cleared] = await db.select({ notes: event.notes, plCode: event.plCode }).from(event).where(eq(event.id, cove.id));
    expect(cleared).toEqual({ notes: null, plCode: "BRL Cove 26" });
  });

  it("edits an item's given fields only, moving or recounting its Stock when asked", async () => {
    await call(quinnsClaude, "editInventoryItem", { id: chairs.id, unitPrice: "14" });
    const [priced] = await db.select().from(item).where(eq(item.id, chairs.id));
    expect(priced).toMatchObject({ name: "Folding chair", sku: "FC-20", unitPriceCents: 1400, description: "Grey, stacks", categoryId: testCategoryId });

    await call(quinnsClaude, "editInventoryItem", { id: chairs.id, locationId: annex.id });
    expect(await db.select({ locationId: stock.locationId, count: stock.count }).from(stock).where(eq(stock.itemId, chairs.id))).toEqual([
      { locationId: annex.id, count: 10 },
    ]);

    await call(quinnsClaude, "editInventoryItem", { id: chairs.id, count: 12 });
    expect(await db.select({ locationId: stock.locationId, count: stock.count }).from(stock).where(eq(stock.itemId, chairs.id))).toEqual([
      { locationId: annex.id, count: 12 },
    ]);
  });

  it("adds, changes and counts Gifts, and adds Borrowed Items, through their own arguments", async () => {
    const totes = await call(quinnsClaude, "createGift", { name: "Tote", unitPrice: "4", startingStock: { locationId: warehouse.id, count: 20 } });
    expect(totes).toMatchObject({ done: "Quinn added Tote to Gifts with 20", mentions: [{ kind: "item", link: `${APP}/gifts/${totes.result.id}` }] });

    expect(await call(quinnsClaude, "editGift", { id: totes.result.id, sku: "TT-1" })).toMatchObject({ done: "Quinn changed Tote's SKU to TT-1" });
    expect(await call(robinsChatGPT, "adjustStock", { itemId: totes.result.id, reason: "given-away", count: 2, note: "Front desk" })).toMatchObject({
      done: expect.stringMatching(/^Robin .*2 Tote/),
    });
    expect(await call(robinsChatGPT, "adjustStock", { itemId: totes.result.id, reason: "recount", countedTo: 15 })).toEqual({ refused: "Only an Admin can do this." });
    await call(quinnsClaude, "adjustStock", { itemId: totes.result.id, reason: "recount", countedTo: 15 });

    const [tote] = await db.select().from(item).where(eq(item.id, totes.result.id));
    expect(tote).toMatchObject({ sku: "TT-1", unitPriceCents: 400 });
    expect(await db.select({ count: stock.count }).from(stock).where(eq(stock.itemId, totes.result.id))).toEqual([{ count: 15 }]);

    expect(await call(robinsChatGPT, "addBorrowedItem", { eventId: cove.id, name: "Photo booth", lender: "Lighthouse AV", count: 1 })).toMatchObject({
      done: "Robin added 1 Photo booth (borrowed) to Cove",
    });
  });

  it("says when nothing changed", async () => {
    expect(await call(quinnsClaude, "renameLocation", { locationId: annex.id, name: "Annex" })).toMatchObject({ done: "Nothing changed: it was already so." });
  });
});
