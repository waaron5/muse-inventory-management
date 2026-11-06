import {
  createDpopReplayStore,
  enforceDpopBinding,
  isDpopBindingError,
  isDpopProofError,
  parseAccessTokenAuthorization,
} from "better-auth/oauth2";
import { and, eq, sql } from "drizzle-orm";
import { oauthAccessToken, oauthClient, user } from "@/db/schema";
import type { ReadDb } from "@/db/types";
import { type Auth, hashAiToken, mcpResource } from "../auth/create-auth";
import { liveAiToken, UNNAMED_APP } from "../auth/ai-tokens";
import type { Role } from "../commands/define";

/** The person an AI Connection acts as, and the app acting for them. */
export type AiConnection = { userId: string; name: string; role: Role; clientId: string; appName: string; aiTokenId: string };

/**
 * Who a call to `/mcp` acts as, read fresh from the database on every call, as
 * commands re-check a session (ADR 0008, ADR 0017): its token must be live and
 * for `/mcp`, and its person active. Null refuses the call.
 */
export async function findAiConnection(db: ReadDb, auth: Auth, request: Request): Promise<AiConnection | null> {
  const authorization = parseAccessTokenAuthorization(request.headers.get("authorization"));
  if (!authorization?.token || authorization.scheme === "Unknown") return null;
  const context = await auth.$context;
  const [found] = await db
    .select({
      aiTokenId: oauthAccessToken.id,
      userId: user.id,
      name: user.name,
      role: user.role,
      clientId: oauthClient.clientId,
      appName: oauthClient.name,
      confirmation: oauthAccessToken.confirmation,
    })
    .from(oauthAccessToken)
    .innerJoin(user, eq(user.id, oauthAccessToken.userId))
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthAccessToken.clientId))
    .where(
      and(
        eq(oauthAccessToken.token, hashAiToken(context.secret, authorization.token)),
        liveAiToken(),
        sql`${mcpResource(context.options.baseURL as string)} = any(${oauthAccessToken.resources})`,
      ),
    );
  if (!found) return null;

  // A token bound to the app's key (DPoP) is good only with a proof from that key.
  try {
    await enforceDpopBinding({
      payload: found.confirmation ? { cnf: found.confirmation } : {},
      authorization,
      proofJwt: request.headers.get("dpop"),
      method: request.method,
      url: request.url,
      replayStore: createDpopReplayStore(context.internalAdapter),
    });
  } catch (error) {
    if (isDpopBindingError(error) || isDpopProofError(error)) return null;
    throw error;
  }
  return { userId: found.userId, name: found.name, role: found.role, clientId: found.clientId, appName: found.appName ?? UNNAMED_APP, aiTokenId: found.aiTokenId };
}
