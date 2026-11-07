import * as Sentry from "@sentry/nextjs";
import { sql } from "drizzle-orm";
import { aiChangeCount } from "@/db/schema";
import type { Db } from "@/db/types";
import { refused } from "./answers";
import type { AiConnection } from "./connection";
import { appLinks } from "./links";

const HOUR = 60 * 60 * 1000;

/** The most changes one AI Connection makes in an hour (ADR 0017). Reads are never limited. */
const CHANGES_AN_HOUR = 300;

/**
 * Counts one change by an AI Connection, before it's made, in one statement so
 * changes sent at once can't all slip under the limit, as sign-in's tries are
 * (ADR 0008). Counted per person and app, not per access token, which an app
 * renews hourly. False when this one is over the limit: nothing is to be made.
 */
export async function takeAiChange(db: Db, connection: Pick<AiConnection, "userId" | "clientId" | "appName">) {
  const now = Date.now();
  const windowStart = new Date(now - (now % HOUR));
  const [counted] = await db
    .insert(aiChangeCount)
    .values({ userId: connection.userId, clientId: connection.clientId, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [aiChangeCount.userId, aiChangeCount.clientId],
      set: {
        count: sql`case when ${aiChangeCount.windowStart} = excluded.window_start then ${aiChangeCount.count} + 1 else 1 end`,
        windowStart: sql`excluded.window_start`,
      },
    })
    .returning({ count: aiChangeCount.count });

  // Once an hour, so a loop shows up without flooding.
  if (counted.count === CHANGES_AN_HOUR + 1) {
    Sentry.captureMessage("An AI Connection reached its hourly change limit", { tags: { app: connection.appName } });
  }
  return counted.count <= CHANGES_AN_HOUR;
}

/** What the AI is told past the limit: nothing was done. */
export function tooManyChanges(appURL: string) {
  return refused(`That's a lot of changes at once. Try again later, or do it in the app: ${appLinks(appURL).to("/")}`);
}
