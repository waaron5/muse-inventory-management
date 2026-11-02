import type {
  PgAsyncDatabase,
  PgAsyncTransaction,
  PgQueryResultHKT,
} from "drizzle-orm/pg-core";
import type { relations } from "./relations";

type Relations = typeof relations;

/** The database, whichever driver is behind it (node-postgres in the app, PGlite in tests). */
export type Db = PgAsyncDatabase<PgQueryResultHKT, Relations>;
export type Tx = PgAsyncTransaction<PgQueryResultHKT, Relations>;

/** What a screen loader is handed: the read half of the database (ADR 0003). */
export type ReadDb = Pick<
  Db,
  "select" | "selectDistinct" | "selectDistinctOn" | "$count" | "$with" | "query"
>;
