import { createMcpHandler } from "@modelcontextprotocol/server";
import type { Db } from "@/db/types";
import { type Auth, mcpResource } from "../auth/create-auth";
import type { Delivery } from "../mail";
import { type AiConnection, findAiConnection } from "./connection";
import { mcpServer } from "./mcp-server";

// Better Auth's routes reachable from outside: OAuth for AI apps and its
// discovery documents. Everything else of Better Auth stays behind Server
// Actions (ADR 0008), so sign-in keeps its own limits.
const PUBLIC_ROUTES: Record<string, readonly string[]> = {
  "/.well-known/oauth-protected-resource": ["GET"],
  "/.well-known/oauth-protected-resource/mcp": ["GET"],
  "/.well-known/oauth-authorization-server/api/auth": ["GET"],
  "/api/auth/.well-known/oauth-authorization-server": ["GET"],
  "/api/auth/.well-known/openid-configuration": ["GET"],
  "/api/auth/oauth2/authorize": ["GET"],
  "/api/auth/oauth2/token": ["POST"],
  "/api/auth/oauth2/register": ["POST"],
  "/api/auth/oauth2/revoke": ["POST"],
};

/**
 * AI Connections' HTTP side (ADR 0017): `/mcp`, and the OAuth routes and
 * discovery documents an AI app connects through. While switched off, all of
 * them are not found.
 */
export function aiEndpoints({
  db,
  auth,
  enabled,
  sendInvite,
}: {
  db: Db;
  auth: Auth;
  enabled: () => boolean;
  sendInvite: (to: string) => Promise<Delivery>;
}) {
  const appURL = auth.options.baseURL as string;
  const resourceMetadata = new URL("/.well-known/oauth-protected-resource/mcp", appURL).toString();
  // Built for each request, as the person whose token `mcp` found.
  const handler = createMcpHandler(({ authInfo }) => mcpServer({ db, appURL, connection: authInfo?.extra?.connection as AiConnection, sendInvite }));

  return {
    async oauth(request: Request): Promise<Response> {
      const allowed = PUBLIC_ROUTES[new URL(request.url).pathname];
      if (!enabled() || !allowed) return notFound();
      if (request.method === "OPTIONS") return preflight();
      if (!allowed.includes(request.method)) return new Response(null, { status: 405, headers: { allow: allowed.join(", ") } });
      return withCors(await auth.handler(request));
    },

    async mcp(request: Request): Promise<Response> {
      if (!enabled()) return notFound();
      if (request.method === "OPTIONS") return preflight();
      const connection = await findAiConnection(db, auth, request);
      if (!connection) return withCors(challenge(request, resourceMetadata));
      const token = (request.headers.get("authorization") ?? "").replace(/^\S+\s+/, "");
      return withCors(await handler.fetch(request, { authInfo: { token, clientId: connection.clientId, scopes: [], resource: new URL(mcpResource(appURL)), extra: { connection } } }));
    },
  };
}

// No token, or one that no longer works: the app is told where to authorize
// (RFC 9728), so it can send its person through connecting again.
function challenge(request: Request, resourceMetadata: string) {
  const hadToken = request.headers.has("authorization");
  const message = hadToken ? "This AI Connection no longer works. Connect again." : "Connect to Muse Inventory first.";
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message }, id: null },
    {
      status: 401,
      headers: {
        "www-authenticate": `Bearer resource_metadata="${resourceMetadata}"${hadToken ? `, error="invalid_token"` : ""}`,
      },
    },
  );
}

function notFound() {
  return new Response("Not found", { status: 404 });
}

// AI apps that run in a browser (and the MCP Inspector) call from their own
// origin. Nothing here reads a cookie, so any origin may.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, dpop, last-event-id, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "www-authenticate, mcp-protocol-version, mcp-session-id",
  "access-control-max-age": "86400",
};

function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
