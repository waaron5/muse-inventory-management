import { sql } from "drizzle-orm";
import { MUSE_TIME_ZONE } from "@/lib/time-zone";

/** Today's calendar date in Muse's time zone, as Postgres computes it. */
export const museToday = sql<string>`(now() at time zone ${sql.raw(`'${MUSE_TIME_ZONE}'`)})::date`;
