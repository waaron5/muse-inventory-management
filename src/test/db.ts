import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { relations } from "@/db/relations";
import { session, user } from "@/db/schema";
import type { Db } from "@/db/types";

/** Furniture, seeded by the Categories migration in every test database. */
export const testCategoryId = "60b2a416-bb1a-4d89-bb85-800a27056eb3";

/** A fresh in-process Postgres, built from the same migrations as production. */
export async function testDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite(), relations });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

/**
 * How many sequential database round trips `work` makes: queries sent while
 * another is still in flight ride along with it (ADR 0006's budget).
 */
export async function countRoundTrips(db: Db, work: () => Promise<unknown>) {
  const client = (db as unknown as { $client: PGlite }).$client;
  const query = client.query;
  let inFlight = 0;
  let trips = 0;
  client.query = (async (...args: Parameters<PGlite["query"]>) => {
    if (inFlight === 0) trips++;
    inFlight++;
    try {
      return await query.apply(client, args);
    } finally {
      inFlight--;
    }
  }) as PGlite["query"];
  try {
    await work();
  } finally {
    client.query = query;
  }
  return trips;
}

/** A person, signed in on one device. */
export async function addUser(
  db: Db,
  values: { role?: "admin" | "user"; banned?: boolean; email?: string; name?: string } = {},
) {
  const id = randomUUID();
  await db.insert(user).values({ id, name: "Test person", email: `${id}@example.com`, ...values });
  return addSession(db, id);
}

/** Signs an existing person in on one more device. */
export async function addSession(db: Db, userId: string) {
  const sessionId = randomUUID();
  await db.insert(session).values({
    id: sessionId,
    userId,
    token: randomUUID(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  });
  return { userId, sessionId };
}
