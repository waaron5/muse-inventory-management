import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { relations } from "./relations";
import type { Db } from "./types";

// Neon suspends after 5 idle minutes (ADR 0006). Close our idle clients well
// before that, and treat a connection Neon drops as routine: the pool discards
// the client and the next query opens a fresh one, waking the database.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
pool.on("error", (error) => {
  console.warn(JSON.stringify({ at: "db-pool", error: error.message }));
});
attachDatabasePool(pool);

export const db: Db = drizzle({ client: pool, relations });
