import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { activity, location, oauthAccessToken, session, user } from "@/db/schema";
import type { Db } from "@/db/types";
import { addAiConnection, addUser, testDb } from "@/test/db";
import { defineCommand } from "./define";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const adminOnly = defineCommand({
  name: "adminOnly",
  ai: false,
  input: z.object({ name: z.string() }),
  allow: ["admin"],
  run: async (tx, actor, input, record) => {
    await tx.insert(location).values({ name: input.name });
    await record("stock", [`added Location ${input.name}`]);
    return actor;
  },
});

const forgetsActivity = defineCommand({
  name: "forgetsActivity",
  ai: false,
  input: z.object({ name: z.string() }),
  allow: ["admin", "user"],
  run: async (tx, _actor, input) => {
    await tx.insert(location).values({ name: input.name });
  },
});

const changesNothing = defineCommand({
  name: "changesNothing",
  ai: false,
  input: z.object({}),
  allow: ["admin", "user"],
  run: async (_tx, _actor, _input, record) => {
    await record("stock", null);
  },
});

const failsHalfway = defineCommand({
  name: "failsHalfway",
  ai: false,
  input: z.object({ name: z.string() }),
  allow: ["admin", "user"],
  run: async (tx, _actor, input) => {
    await tx.insert(location).values({ name: input.name });
    throw new Error("History write failed");
  },
});

describe("defineCommand", () => {
  it("records the change as Activity, by the actor", async () => {
    const actor = await addUser(db, { role: "admin" });

    await adminOnly(db, actor, { name: "Annex" });

    expect(await db.select().from(activity).where(eq(activity.byUserId, actor.userId))).toMatchObject([
      { area: "stock", sentence: ["added Location Annex"] },
    ]);
  });

  it("saves nothing from a command that doesn't record its Activity", async () => {
    const actor = await addUser(db, { role: "admin" });
    const before = await db.$count(location);

    await expect(forgetsActivity(db, actor, { name: "Forgotten" })).rejects.toThrow("recorded its Activity 0 times");
    expect(await db.$count(location)).toBe(before);
  });

  it("writes no entry when the command changed nothing", async () => {
    const actor = await addUser(db, { role: "admin" });

    await changesNothing(db, actor, {});

    expect(await db.$count(activity, eq(activity.byUserId, actor.userId))).toBe(0);
  });

  it("runs for an allowed role, reading the role from the database", async () => {
    const actor = await addUser(db, { role: "admin" });

    await expect(adminOnly(db, actor, { name: "Warehouse" })).resolves.toEqual({
      userId: actor.userId,
      role: "admin",
    });
  });

  it("refuses a role that isn't allowed, and writes nothing", async () => {
    const actor = await addUser(db, { role: "user" });
    const before = await db.$count(location);

    await expect(adminOnly(db, actor, { name: "Warehouse" })).rejects.toMatchObject({
      code: "not-allowed",
    });
    expect(await db.$count(location)).toBe(before);
  });

  it("refuses a device signed out since its cookie was issued", async () => {
    const actor = await addUser(db, { role: "admin" });
    await db.delete(session).where(eq(session.id, actor.sessionId));

    await expect(adminOnly(db, actor, { name: "Warehouse" })).rejects.toMatchObject({
      code: "not-signed-in",
    });
  });

  it("refuses a session that has expired", async () => {
    const actor = await addUser(db, { role: "admin" });
    await db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(session.id, actor.sessionId));

    await expect(adminOnly(db, actor, { name: "Warehouse" })).rejects.toMatchObject({
      code: "not-signed-in",
    });
  });

  it("refuses a session that belongs to someone else", async () => {
    const admin = await addUser(db, { role: "admin" });
    const user = await addUser(db, { role: "user" });

    await expect(
      adminOnly(db, { userId: admin.userId, sessionId: user.sessionId }, { name: "Warehouse" }),
    ).rejects.toMatchObject({ code: "not-signed-in" });
  });

  it("rolls back the whole change when any part of it fails", async () => {
    const actor = await addUser(db);
    const before = await db.$count(location);

    await expect(failsHalfway(db, actor, { name: "Storage unit" })).rejects.toThrow(
      "History write failed",
    );
    expect(await db.$count(location)).toBe(before);
  });

  it("records a change made through an AI Connection as its person's, with the app", async () => {
    const admin = await addUser(db, { role: "admin" });
    const viaClaude = await addAiConnection(db, admin.userId, { name: "Claude", clientId: "claude-app" });

    await adminOnly(db, viaClaude, { name: "Loft" });
    await adminOnly(db, admin, { name: "Garage" });

    expect(
      await db
        .select({ sentence: activity.sentence, viaAiClientId: activity.viaAiClientId, viaAiApp: activity.viaAiApp })
        .from(activity)
        .where(eq(activity.byUserId, admin.userId))
        .orderBy(activity.recordedAt),
    ).toEqual([
      { sentence: ["added Location Loft"], viaAiClientId: "claude-app", viaAiApp: "Claude" },
      { sentence: ["added Location Garage"], viaAiClientId: null, viaAiApp: null },
    ]);
  });

  it("names an app that gave no name \"AI app\" in its Activity", async () => {
    const admin = await addUser(db, { role: "admin" });
    const viaUnnamed = await addAiConnection(db, admin.userId, { name: null });

    await adminOnly(db, viaUnnamed, { name: "Attic" });

    expect(await db.select({ viaAiApp: activity.viaAiApp }).from(activity).where(eq(activity.byUserId, admin.userId))).toEqual([{ viaAiApp: "AI app" }]);
  });

  it("checks an AI Connection's role in the database, as a session's", async () => {
    const person = await addUser(db, { role: "user" });
    const viaAi = await addAiConnection(db, person.userId);

    await expect(adminOnly(db, viaAi, { name: "Warehouse" })).rejects.toMatchObject({
      code: "not-allowed",
      message: "Only an Admin can do this.",
    });
  });

  it("refuses an AI Connection whose token was revoked or has expired, or whose person was deactivated", async () => {
    const revoked = await addUser(db, { role: "admin" });
    const revokedAi = await addAiConnection(db, revoked.userId);
    await db.update(oauthAccessToken).set({ revoked: new Date() }).where(eq(oauthAccessToken.id, revokedAi.aiTokenId));

    const expired = await addUser(db, { role: "admin" });
    const expiredAi = await addAiConnection(db, expired.userId);
    await db.update(oauthAccessToken).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(oauthAccessToken.id, expiredAi.aiTokenId));

    const deactivated = await addUser(db, { role: "admin" });
    const deactivatedAi = await addAiConnection(db, deactivated.userId);
    await db.update(user).set({ banned: true }).where(eq(user.id, deactivated.userId));

    const someoneElse = await addUser(db, { role: "admin" });
    const borrowed = { userId: someoneElse.userId, aiTokenId: (await addAiConnection(db, revoked.userId)).aiTokenId };

    for (const actor of [revokedAi, expiredAi, deactivatedAi, borrowed]) {
      await expect(adminOnly(db, actor, { name: "Warehouse" })).rejects.toMatchObject({ code: "not-signed-in" });
    }
  });

  it("gives the change's Activity with its result", async () => {
    const actor = await addUser(db, { role: "admin" });

    await expect(adminOnly.withActivity(db, actor, { name: "Shed" })).resolves.toEqual({
      output: { userId: actor.userId, role: "admin" },
      activity: { area: "stock", sentence: ["added Location Shed"] },
    });
    await expect(changesNothing.withActivity(db, actor, {})).resolves.toEqual({ output: undefined, activity: null });
  });
});
