import { and, eq, gt, isNull, not, sql } from "drizzle-orm";
import { oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken, user, verification } from "@/db/schema";
import type { Tx } from "@/db/types";

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

/**
 * Ends a person's AI Connections (ADR 0017), or only the one through `clientId`:
 * their tokens, so the next call is refused; their Allow, so connecting again
 * asks for it again; and any code on its way back to the app, so it can't be
 * swapped for new tokens afterwards.
 */
export async function endAiConnections(tx: Tx, userId: string, clientId?: string) {
  const theirs = (table: typeof oauthAccessToken | typeof oauthRefreshToken | typeof oauthConsent) =>
    and(eq(table.userId, userId), clientId === undefined ? undefined : eq(table.clientId, clientId));
  await tx.delete(oauthAccessToken).where(theirs(oauthAccessToken));
  await tx.delete(oauthRefreshToken).where(theirs(oauthRefreshToken));
  await tx.delete(oauthConsent).where(theirs(oauthConsent));
  // Better Auth keeps a code as JSON among sign-in's other verification rows,
  // which aren't JSON, so only a code's is read as JSON.
  const code = sql`case when ${verification.value} like '{"type":"authorization_code"%' then ${verification.value}::jsonb end`;
  await tx.delete(verification).where(
    and(
      sql`${code} ->> 'userId' = ${userId}`,
      clientId === undefined ? undefined : sql`${code} -> 'query' ->> 'client_id' = ${clientId}`,
    ),
  );
}
