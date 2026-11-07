import { and, desc, eq, sql } from "drizzle-orm";
import { oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken } from "@/db/schema";
import { UNNAMED_APP } from "../auth/ai-tokens";
import { defineLoader } from "./define";

/** One of a person's AI Connections, as Settings lists it. */
export type AiConnectionShown = { clientId: string; appName: string; connectedAt: Date; lastUsedAt: Date };

/**
 * A person's own AI Connections (ADR 0017), newest first: each app they've
 * Allowed that can still reach `/mcp` or renew its access, so one that lapsed
 * after 90 unused days, or was disconnected, is gone. Nobody sees anyone
 * else's, Admins included.
 *
 * An app gets a new access token at least hourly while it's in use, so the
 * newest one says when it was last used without writing on every call.
 */
export const loadAiConnections = defineLoader("aiConnections", async (db, userId: string) => {
  const connectedAt = sql`coalesce(
    (select max(coalesce(${oauthConsent.updatedAt}, ${oauthConsent.createdAt})) from ${oauthConsent}
      where ${oauthConsent.clientId} = ${oauthClient.clientId} and ${oauthConsent.userId} = ${userId}),
    min(${oauthAccessToken.createdAt}))`.mapWith(oauthAccessToken.createdAt);
  const rows = await db
    .select({
      clientId: oauthClient.clientId,
      appName: oauthClient.name,
      connectedAt,
      lastUsedAt: sql`max(${oauthAccessToken.createdAt})`.mapWith(oauthAccessToken.createdAt),
    })
    .from(oauthAccessToken)
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthAccessToken.clientId))
    .where(and(eq(oauthAccessToken.userId, userId), sql`not coalesce(${oauthClient.disabled}, false)`))
    .groupBy(oauthClient.clientId, oauthClient.name)
    .having(sql`bool_or(${oauthAccessToken.expiresAt} > now() and ${oauthAccessToken.revoked} is null)
      or exists (select 1 from ${oauthRefreshToken}
        where ${oauthRefreshToken.clientId} = ${oauthClient.clientId} and ${oauthRefreshToken.userId} = ${userId}
          and ${oauthRefreshToken.revoked} is null and ${oauthRefreshToken.expiresAt} > now())`)
    .orderBy(desc(connectedAt), oauthClient.clientId);
  return {
    connections: rows.map((row): AiConnectionShown => ({
      clientId: row.clientId,
      appName: row.appName?.trim() || UNNAMED_APP,
      connectedAt: row.connectedAt as Date,
      lastUsedAt: row.lastUsedAt as Date,
    })),
  };
});
