import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { oauthAccessToken, oauthConsent, oauthRefreshToken } from "@/db/schema";
import type { Db } from "@/db/types";
import { addAiConnection, addUser, countRoundTrips, testDb } from "@/test/db";
import { loadAiConnections } from "./ai-connections";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);
const daysAgo = (at: Date) => Math.round((Date.now() - at.getTime()) / DAY);
const hoursAgo = (at: Date) => Math.round((Date.now() - at.getTime()) / HOUR);

/** The app, Allowed some time ago, with a refresh token that keeps it going. */
async function allowed(db: Db, userId: string, app: { name?: string | null; clientId?: string }, at: { allowedAgo: number; refreshedAgo: number }) {
  const connection = await addAiConnection(db, userId, app);
  const [{ clientId }] = await db
    .select({ clientId: oauthAccessToken.clientId })
    .from(oauthAccessToken)
    .where(eq(oauthAccessToken.id, connection.aiTokenId));
  await db.update(oauthAccessToken).set({ createdAt: ago(at.refreshedAgo), expiresAt: new Date(ago(at.refreshedAgo).getTime() + HOUR) })
    .where(eq(oauthAccessToken.id, connection.aiTokenId));
  await db.insert(oauthConsent).values({ id: randomUUID(), clientId, userId, scopes: [], createdAt: ago(at.allowedAgo), updatedAt: ago(at.allowedAgo) });
  await db.insert(oauthRefreshToken).values({
    id: randomUUID(), token: randomUUID(), clientId, userId, scopes: [],
    createdAt: ago(at.refreshedAgo), expiresAt: new Date(ago(at.refreshedAgo).getTime() + 90 * DAY),
  });
  return clientId;
}

describe("loadAiConnections", () => {
  it("lists a person's own AI Connections, newest first, with when each was connected and last used", async () => {
    const db = await testDb();
    const person = await addUser(db);
    const claude = await allowed(db, person.userId, { name: "Claude" }, { allowedAgo: 20 * DAY, refreshedAgo: 2 * HOUR });
    const chatgpt = await allowed(db, person.userId, { name: "ChatGPT" }, { allowedAgo: 3 * DAY, refreshedAgo: 3 * DAY });

    const { connections } = await loadAiConnections(db, person.userId);

    expect(connections.map(({ connectedAt, lastUsedAt, ...rest }) => ({ ...rest, connected: daysAgo(connectedAt), used: hoursAgo(lastUsedAt) }))).toEqual([
      { clientId: chatgpt, appName: "ChatGPT", connected: 3, used: 72 },
      { clientId: claude, appName: "Claude", connected: 20, used: 2 },
    ]);
  });

  it("names an app that gave no name as an AI app", async () => {
    const db = await testDb();
    const person = await addUser(db);
    await allowed(db, person.userId, { name: null }, { allowedAgo: DAY, refreshedAgo: DAY });

    const { connections } = await loadAiConnections(db, person.userId);

    expect(connections.map((c) => c.appName)).toEqual(["An AI app"]);
  });

  it("leaves out other people's, even through the same app", async () => {
    const db = await testDb();
    const person = await addUser(db);
    const admin = await addUser(db, { role: "admin" });
    const claude = await allowed(db, person.userId, { name: "Claude" }, { allowedAgo: DAY, refreshedAgo: DAY });
    await allowed(db, admin.userId, { name: "Claude", clientId: claude }, { allowedAgo: DAY, refreshedAgo: DAY });
    await allowed(db, admin.userId, { name: "Grok" }, { allowedAgo: DAY, refreshedAgo: DAY });

    expect((await loadAiConnections(db, person.userId)).connections.map((c) => c.appName)).toEqual(["Claude"]);
    expect((await loadAiConnections(db, admin.userId)).connections.map((c) => c.appName).sort()).toEqual(["Claude", "Grok"]);
  });

  it("leaves out one that lapsed or whose tokens were revoked", async () => {
    const db = await testDb();
    const person = await addUser(db);
    await allowed(db, person.userId, { name: "Lapsed" }, { allowedAgo: 200 * DAY, refreshedAgo: 91 * DAY });
    const revoked = await allowed(db, person.userId, { name: "Revoked" }, { allowedAgo: DAY, refreshedAgo: 2 * HOUR });
    await db.update(oauthRefreshToken).set({ revoked: new Date() }).where(eq(oauthRefreshToken.clientId, revoked));
    await allowed(db, person.userId, { name: "Live" }, { allowedAgo: 89 * DAY, refreshedAgo: 89 * DAY });

    const { connections } = await loadAiConnections(db, person.userId);

    expect(connections.map((c) => c.appName)).toEqual(["Live"]);
  });

  it("counts one with only a live access token, connected when that was issued", async () => {
    const db = await testDb();
    const person = await addUser(db);
    await addAiConnection(db, person.userId, { name: "Claude" });

    const { connections } = await loadAiConnections(db, person.userId);

    expect(connections).toEqual([{ clientId: expect.any(String), appName: "Claude", connectedAt: expect.any(Date), lastUsedAt: expect.any(Date) }]);
  });

  it("stays within 2 sequential round trips", async () => {
    const db = await testDb();
    const person = await addUser(db);

    expect(await countRoundTrips(db, () => loadAiConnections(db, person.userId))).toBeLessThanOrEqual(2);
  });
});
