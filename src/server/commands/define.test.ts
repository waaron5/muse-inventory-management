import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { activity, location, session } from "@/db/schema";
import type { Db } from "@/db/types";
import { addUser, testDb } from "@/test/db";
import { defineCommand } from "./define";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const adminOnly = defineCommand({
  name: "adminOnly",
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
  input: z.object({ name: z.string() }),
  allow: ["admin", "user"],
  run: async (tx, _actor, input) => {
    await tx.insert(location).values({ name: input.name });
  },
});

const changesNothing = defineCommand({
  name: "changesNothing",
  input: z.object({}),
  allow: ["admin", "user"],
  run: async (_tx, _actor, _input, record) => {
    await record("stock", null);
  },
});

const failsHalfway = defineCommand({
  name: "failsHalfway",
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
});
