import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { activity, event, item, line, session, user } from "@/db/schema";
import type { Db } from "@/db/types";
import { todayInMuse } from "@/lib/time-zone";
import { testDb } from "@/test/db";
import { DEMO_ADMIN, ensureDemoAdmin, resetDemo } from "./seed";

let db: Db;
beforeAll(async () => {
  db = await testDb();
  await resetDemo(db);
});

describe("resetDemo", () => {
  it("seeds people, a catalog, and Events past, on now, coming up, undated and cancelled", async () => {
    const today = todayInMuse();
    const events = await db.select().from(event);
    expect(await db.$count(item)).toBeGreaterThanOrEqual(50);
    expect(events.length).toBeGreaterThanOrEqual(15);
    expect(events.some((e) => e.endsOn !== null && e.endsOn < today)).toBe(true);
    expect(events.some((e) => e.startsOn !== null && e.startsOn <= today && e.endsOn! >= today)).toBe(true);
    expect(events.some((e) => e.startsOn !== null && e.startsOn > today)).toBe(true);
    expect(events.some((e) => e.startsOn === null)).toBe(true);
    expect(events.some((e) => e.cancelledAt !== null)).toBe(true);
    const [admin] = await db.select().from(user).where(eq(user.email, DEMO_ADMIN.email));
    expect(admin).toMatchObject({ name: DEMO_ADMIN.name, role: "admin", banned: false });
  });

  it("leaves Activity spread over the past weeks, and nobody signed in", async () => {
    const [{ oldest }] = await db.select({ oldest: sql<string>`min(${activity.recordedAt})::text` }).from(activity);
    expect(new Date(oldest).getTime()).toBeLessThan(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(await db.$count(session)).toBe(0);
  });

  it("gives away the Gifts of Events that have ended, as the nightly run does", async () => {
    const waiting = await db.$count(
      line,
      sql`${line.givenAwayAt} is null and ${line.itemId} in (select id from item where kind = 'gift')
        and ${line.eventId} in (select id from event where ends_on < ${todayInMuse()} and cancelled_at is null)`,
    );
    expect(waiting).toBe(0);
  });

  it("starts over from the same data when run again", async () => {
    const before = { items: await db.$count(item), events: await db.$count(event), people: await db.$count(user) };
    await db.insert(user).values({ id: "visitor-added", name: "Someone", email: "someone@example.com" });

    await resetDemo(db);

    expect({ items: await db.$count(item), events: await db.$count(event), people: await db.$count(user) }).toEqual(before);
  });
});

describe("ensureDemoAdmin", () => {
  it("puts the demo's Admin back as an active, named Admin", async () => {
    await db.update(user).set({ role: "user", banned: true, name: "" }).where(eq(user.email, DEMO_ADMIN.email));

    await ensureDemoAdmin(db);

    const [admin] = await db.select().from(user).where(eq(user.email, DEMO_ADMIN.email));
    expect(admin).toMatchObject({ name: DEMO_ADMIN.name, role: "admin", banned: false });
  });
});
