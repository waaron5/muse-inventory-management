import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { stock } from "@/db/schema";
import type { Db } from "@/db/types";
import { addAiConnection, addUser, testCategoryId, testDb } from "@/test/db";
import { adjustStock } from "../commands/adjust-stock";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import type { AiConnection } from "./connection";
import { mcpServer } from "./mcp-server";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));

const APP = "https://inventory.museem.com";
const TOO_MANY = `That's a lot of changes at once. Try again later, or do it in the app: ${APP}/`;
const HOUR = 60 * 60 * 1000;

describe("an AI Connection's changes an hour", () => {
  let db: Db;
  let chairs: { id: string };
  let bugReportsSent = 0;

  beforeAll(async () => {
    db = await testDb();
    const admin = await addUser(db, { role: "admin", name: "Sam" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    chairs = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair", startingStock: { locationId: warehouse.id, count: 0 } });
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Far from an hour's edge, so a test's calls stay in one window.
    vi.setSystemTime("2026-11-06T10:10:10Z");
    vi.mocked(Sentry.captureMessage).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // A person and their app, as `/mcp` finds them for a call: a new server per
  // call, as each request to `/mcp` gets.
  async function connect(appName = "Claude") {
    const person = await addUser(db, { role: "user", name: "Robin" });
    const { aiTokenId, clientId } = await addAiConnection(db, person.userId, { name: appName });
    const connection: AiConnection = { userId: person.userId, name: "Robin", email: "robin@museem.com", role: "user", clientId, appName, aiTokenId };
    return { person, connection };
  }

  // The app's new access token, as it gets at least hourly.
  async function renewed(connection: AiConnection): Promise<AiConnection> {
    const { aiTokenId } = await addAiConnection(db, connection.userId, { clientId: connection.clientId });
    return { ...connection, aiTokenId };
  }

  async function call(connection: AiConnection, name: string, args: Record<string, unknown>) {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await mcpServer({ db, appURL: APP, connection, sendInvite: async () => "emailed", sendBugMail: async () => (bugReportsSent++, true) }).connect(serverSide);
    const ai = new Client({ name: connection.appName, version: "1.0.0" });
    await ai.connect(clientSide);
    const result = await ai.callTool({ name, arguments: args });
    await ai.close();
    const text = (result.content as { text: string }[])[0].text;
    return result.isError ? { refused: text } : JSON.parse(text);
  }

  const found = (connection: AiConnection) => call(connection, "adjustStock", { itemId: chairs.id, reason: "found", count: 1 });
  const count = async () => (await db.select({ count: stock.count }).from(stock).where(eq(stock.itemId, chairs.id)))[0].count;

  it("refuses the 301st change in an hour and writes nothing, then allows it the next hour", async () => {
    const { connection } = await connect();
    const before = await count();
    for (let made = 0; made < 300; made++) expect(await found(connection)).not.toHaveProperty("refused");
    expect(await count()).toBe(before + 300);

    expect(await found(connection)).toEqual({ refused: TOO_MANY });
    expect(await count()).toBe(before + 300);
    expect(Sentry.captureMessage).toHaveBeenCalledOnce();
    // A renewed access token is the same AI Connection.
    expect(await found(await renewed(connection))).toEqual({ refused: TOO_MANY });

    vi.setSystemTime(Date.now() + HOUR);
    expect(await found(await renewed(connection))).not.toHaveProperty("refused");
    expect(await count()).toBe(before + 301);
  }, 60_000);

  it("never limits reads", async () => {
    const { connection } = await connect();
    for (let made = 0; made < 300; made++) await found(connection);

    expect(await call(connection, "search", { query: "chair" })).not.toHaveProperty("refused");
    expect(await call(connection, "item", { id: chairs.id })).not.toHaveProperty("refused");
  }, 60_000);

  it("counts a bug report as a change, so past the limit none is sent", async () => {
    const { connection } = await connect();
    for (let made = 0; made < 299; made++) await found(connection);
    const sent = bugReportsSent;

    expect(await call(connection, "reportBug", { what: "Search times out" })).not.toHaveProperty("refused");
    expect(await call(connection, "reportBug", { what: "Search times out" })).toEqual({ refused: TOO_MANY });
    expect(bugReportsSent).toBe(sent + 1);
  }, 60_000);

  it("doesn't count the person's own changes on screen, nor another of their AI Connections'", async () => {
    const { person, connection: claude } = await connect("Claude");
    const chatGPT: AiConnection = { ...claude, ...(await addAiConnection(db, person.userId, { name: "ChatGPT" })), appName: "ChatGPT" };
    for (let made = 0; made < 300; made++) await adjustStock(db, person, { itemId: chairs.id, reason: "found", count: 1 });
    for (let made = 0; made < 299; made++) await found(claude);

    expect(await found(claude)).not.toHaveProperty("refused");
    expect(await found(chatGPT)).not.toHaveProperty("refused");
    expect(await found(claude)).toEqual({ refused: TOO_MANY });
  }, 60_000);
});
