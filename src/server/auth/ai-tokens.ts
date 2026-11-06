import { and, eq, gt, isNull, not, sql } from "drizzle-orm";
import { oauthAccessToken, oauthClient, user } from "@/db/schema";

/** What an AI app is called when it gave no name. */
export const UNNAMED_APP = "An AI app";

/**
 * An AI Connection's access token that still works (ADR 0017): not expired
 * nor revoked, its app not disabled, its person active. For a query joining
 * the token with its person and its app.
 */
export const liveAiToken = () =>
  and(
    gt(oauthAccessToken.expiresAt, sql`now()`),
    isNull(oauthAccessToken.revoked),
    eq(user.banned, false),
    not(sql`coalesce(${oauthClient.disabled}, false)`),
  );
