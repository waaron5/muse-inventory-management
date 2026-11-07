import {
  auth as authorizeClient,
  Client,
  type OAuthClientInformationMixed,
  type OAuthClientProvider,
  type OAuthTokens,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { activity, oauthAccessToken, oauthRefreshToken, user } from "@/db/schema";
import type { Db } from "@/db/types";
import { testAuth } from "@/test/auth";
import { addSession, addUser, testCategoryId, testDb } from "@/test/db";
import type { Auth } from "../auth/create-auth";
import { sendCode, signIn } from "../auth/sign-in";
import { createEvent } from "../commands/create-event";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import { disconnectAiConnection } from "../commands/ai-connections";
import { deactivateUser, deleteUser } from "../commands/users";
import { answerConnectRequest, continueAfterSignIn, readConnectRequest } from "./connect";
import { aiEndpoints } from "./endpoints";

const APP = "http://localhost:3000";
const MCP = `${APP}/mcp`;
const CALLBACK = "http://localhost:53682/callback";

/** An AI app's side of OAuth, kept in memory, as the MCP SDK asks a client to. */
class AiApp implements OAuthClientProvider {
  redirectUrl = CALLBACK;
  clientMetadata = {
    client_name: "Claude",
    redirect_uris: [CALLBACK],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
  information?: OAuthClientInformationMixed;
  saved?: OAuthTokens;
  verifier = "";
  /** Where the app last sent its person's browser. */
  sentTo?: URL;
  clientInformation = () => this.information;
  saveClientInformation = (information: OAuthClientInformationMixed) => void (this.information = information);
  tokens = () => this.saved;
  saveTokens = (tokens: OAuthTokens) => void (this.saved = tokens);
  redirectToAuthorization = (url: URL) => void (this.sentTo = url);
  saveCodeVerifier = (verifier: string) => void (this.verifier = verifier);
  codeVerifier = () => this.verifier;
}

describe("AI Connections", () => {
  let db: Db;
  let auth: Auth;
  let codeFor: (email: string) => string;
  let app: typeof fetch;

  beforeAll(async () => {
    db = await testDb();
    const made = testAuth(db);
    auth = made.auth;
    codeFor = (email) => made.outbox.codeFor(email);
    const endpoints = aiEndpoints({ db, auth, enabled: () => true, sendInvite: async () => "emailed" });
    app = routeTo(endpoints);

    const admin = await addUser(db, { role: "admin" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Folding chair",
      sku: "FC-20",
      startingStock: { locationId: warehouse.id, count: 40 },
    });
    await createEvent(db, admin, { name: "Sales kickoff", client: { name: "Birchline" }, startsOn: "2026-11-10" });
  });

  /** Someone invited, signed in in their browser: the cookie it sends. */
  async function signedInPerson(role: "admin" | "user" = "user") {
    const id = randomUUID();
    const email = `${id}@example.com`;
    await db.insert(user).values({ id, name: "Quinn", email, role });
    await sendCode(auth, email);
    const result = await signIn(auth, email, codeFor(email));
    if (!result.ok) throw new Error(result.message);
    return { id, cookie: result.cookie };
  }

  /** The app discovers Muse Inventory, registers, and sends its person to the Allow screen. */
  async function startConnecting(aiApp: AiApp, cookie: Headers) {
    expect(await authorizeClient(aiApp, { serverUrl: MCP, fetchFn: app })).toBe("REDIRECT");
    const toAllow = await app(aiApp.sentTo!, { headers: cookie, redirect: "manual" });
    expect(toAllow.status).toBe(302);
    const allowScreen = new URL(toAllow.headers.get("location")!, APP);
    expect(allowScreen.pathname).toBe("/connect");
    return allowScreen;
  }

  /** Connects an app all the way: the person presses Allow, and the app gets its tokens. Optionally the app another person registered. */
  async function connect(cookie: Headers, sameAppAs?: AiApp) {
    const aiApp = new AiApp();
    aiApp.information = sameAppAs?.information;
    const allowScreen = await startConnecting(aiApp, cookie);
    const back = new URL(await answerConnectRequest(auth, cookie, allowScreen.search, true));
    expect(`${back.origin}${back.pathname}`).toBe(CALLBACK);
    const finished = await authorizeClient(aiApp, {
      serverUrl: MCP,
      fetchFn: app,
      authorizationCode: back.searchParams.get("code")!,
      iss: back.searchParams.get("iss")!,
    });
    expect(finished).toBe("AUTHORIZED");
    return aiApp;
  }

  async function mcpClient(aiApp: AiApp) {
    const client = new Client({ name: "test", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(MCP), { authProvider: aiApp, fetch: app }));
    return client;
  }

  /** The app renews its access with its refresh token, as it does each hour it's in use; whether that worked. */
  async function refresh(aiApp: AiApp) {
    const response = await app(`${APP}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: aiApp.saved!.refresh_token!,
        client_id: aiApp.information!.client_id,
        resource: MCP,
      }),
    });
    if (response.ok) aiApp.saved = await response.json();
    return response.ok;
  }

  /** Time passes for someone's AI Connections: every token they hold was issued, and expires, that much earlier. */
  async function daysPass(userId: string, days: number) {
    const earlier = sql`interval '1 day' * ${days}`;
    await db.update(oauthAccessToken)
      .set({ createdAt: sql`${oauthAccessToken.createdAt} - ${earlier}`, expiresAt: sql`${oauthAccessToken.expiresAt} - ${earlier}` })
      .where(eq(oauthAccessToken.userId, userId));
    await db.update(oauthRefreshToken)
      .set({ createdAt: sql`${oauthRefreshToken.createdAt} - ${earlier}`, expiresAt: sql`${oauthRefreshToken.expiresAt} - ${earlier}` })
      .where(eq(oauthRefreshToken.userId, userId));
  }

  const callMcp = (token: string) =>
    app(MCP, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
      }),
    });

  it("lets an AI app discover Muse Inventory, register, be Allowed by its signed-in person and search", async () => {
    const person = await signedInPerson();
    const client = await mcpClient(await connect(person.cookie));

    const result = await client.callTool({ name: "search", arguments: { query: "folding" } });

    const found = JSON.parse((result.content as { text: string }[])[0].text);
    expect(found.inventoryItems.found).toEqual([
      expect.objectContaining({
        name: "Folding chair",
        sku: "FC-20",
        location: "Warehouse",
        category: "Furniture",
        count: 40,
        link: expect.stringMatching(new RegExp(`^${APP}/inventory/[0-9a-f-]{36}$`)),
      }),
    ]);
    const events = JSON.parse(((await client.callTool({ name: "search", arguments: { query: "kickoff" } })).content as { text: string }[])[0].text).events;
    expect(events.found).toEqual([
      expect.objectContaining({ name: "Sales kickoff", client: "Birchline", startsOn: "2026-11-10", link: expect.stringMatching(`^${APP}/events/`) }),
    ]);
  });

  it("marks its reads read-only and its changes not, and tells the AI how to work in Muse", async () => {
    const person = await signedInPerson();
    const client = await mcpClient(await connect(person.cookie));

    const { tools } = await client.listTools();

    expect(tools.find((tool) => tool.name === "search")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((tool) => tool.name === "reserve")?.annotations?.readOnlyHint).toBe(false);
    expect(client.getInstructions()).toMatch(/never guess/i);
    expect(client.getInstructions()).toMatch(/link/i);
  });

  it("makes a change as its person, marked with its app in Activity", async () => {
    const person = await signedInPerson();
    const client = await mcpClient(await connect(person.cookie));

    const result = await client.callTool({ name: "createLocation", arguments: { name: "Loading dock" } });

    expect(JSON.parse((result.content as { text: string }[])[0].text)).toMatchObject({ done: "Quinn added Location Loading dock" });
    expect(await db.select({ viaAiApp: activity.viaAiApp }).from(activity).where(eq(activity.byUserId, person.id))).toEqual([{ viaAiApp: "Claude" }]);
  });

  it("names the app and where it returns to on the Allow screen, and refuses a changed request", async () => {
    const person = await signedInPerson();
    const allowScreen = await startConnecting(new AiApp(), person.cookie);

    expect(await readConnectRequest(auth, allowScreen.searchParams, person.cookie)).toEqual({ appName: "Claude", returnsTo: "localhost" });

    const changed = new URLSearchParams(allowScreen.searchParams);
    changed.set("redirect_uri", "https://evil.example/callback");
    expect(await readConnectRequest(auth, changed, person.cookie)).toBeNull();
  });

  it("sends someone not yet signed in to sign in first, then on to the Allow screen", async () => {
    const aiApp = new AiApp();
    await authorizeClient(aiApp, { serverUrl: MCP, fetchFn: app });

    const toSignIn = await app(aiApp.sentTo!, { redirect: "manual" });
    const signInScreen = new URL(toSignIn.headers.get("location")!, APP);
    expect(signInScreen.pathname).toBe("/sign-in");

    const person = await signedInPerson();
    const next = await continueAfterSignIn(auth, signInScreen.search);
    const toAllow = await app(new URL(next!, APP), { headers: person.cookie, redirect: "manual" });
    expect(new URL(toAllow.headers.get("location")!, APP).pathname).toBe("/connect");
    expect(await continueAfterSignIn(auth, "?client_id=x&sig=forged")).toBeNull();
  });

  it("sends the person back with nothing granted when they press Cancel", async () => {
    const person = await signedInPerson();
    const aiApp = new AiApp();
    const allowScreen = await startConnecting(aiApp, person.cookie);

    const back = new URL(await answerConnectRequest(auth, person.cookie, allowScreen.search, false));

    expect(back.searchParams.get("error")).toBe("access_denied");
    expect(back.searchParams.get("code")).toBeNull();
  });

  it("challenges a call with no token, or a wrong one, with where to authorize", async () => {
    for (const response of [await app(MCP, { method: "POST" }), await callMcp("not-a-token")]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain(`resource_metadata="${APP}/.well-known/oauth-protected-resource/mcp"`);
    }
  });

  it("refuses a deactivated person's AI Connection on its next call, for good", async () => {
    const admin = await addUser(db, { role: "admin" });
    const person = await signedInPerson();
    const aiApp = await connect(person.cookie);
    expect((await callMcp(aiApp.saved!.access_token)).status).toBe(200);

    await deactivateUser(db, admin, { userId: person.id });

    expect((await callMcp(aiApp.saved!.access_token)).status).toBe(401);
    expect(await refresh(aiApp)).toBe(false);
  });

  it("refuses an AI Connection on its next call once its person Disconnects it, and only that one", async () => {
    const person = await signedInPerson();
    const claude = await connect(person.cookie);
    const grok = await connect(person.cookie);
    // Through a Client ID Metadata Document, everyone's Claude is the same app.
    const someoneElse = await signedInPerson();
    const theirClaude = await connect(someoneElse.cookie, claude);

    await disconnectAiConnection(db, await addSession(db, person.id), { clientId: claude.information!.client_id });

    expect((await callMcp(claude.saved!.access_token)).status).toBe(401);
    expect(await refresh(claude)).toBe(false);
    expect((await callMcp(grok.saved!.access_token)).status).toBe(200);
    expect((await callMcp(theirClaude.saved!.access_token)).status).toBe(200);
    // Connecting again asks for Allow again.
    claude.saved = undefined;
    await startConnecting(claude, person.cookie);
  });

  it("refuses a code its app was sent just before its person Disconnected or was deactivated", async () => {
    const admin = await addUser(db, { role: "admin" });
    for (const end of ["disconnect", "deactivate"] as const) {
      const person = await signedInPerson();
      const aiApp = await connect(person.cookie);
      // The app asks again; already Allowed, its code is on its way back to it.
      aiApp.saved = undefined;
      expect(await authorizeClient(aiApp, { serverUrl: MCP, fetchFn: app })).toBe("REDIRECT");
      const back = new URL((await app(aiApp.sentTo!, { headers: person.cookie, redirect: "manual" })).headers.get("location")!);
      expect(`${back.origin}${back.pathname}`).toBe(CALLBACK);

      if (end === "disconnect") {
        await disconnectAiConnection(db, await addSession(db, person.id), { clientId: aiApp.information!.client_id });
      } else {
        await deactivateUser(db, admin, { userId: person.id });
      }

      await expect(
        authorizeClient(aiApp, { serverUrl: MCP, fetchFn: app, authorizationCode: back.searchParams.get("code")!, iss: back.searchParams.get("iss")! }),
      ).rejects.toThrow();
    }
  });

  it("lapses after 90 days unused, each use renewing it", async () => {
    const person = await signedInPerson();
    const aiApp = await connect(person.cookie);

    await daysPass(person.id, 60);
    expect((await callMcp(aiApp.saved!.access_token)).status).toBe(401);
    expect(await refresh(aiApp)).toBe(true);
    expect((await callMcp(aiApp.saved!.access_token)).status).toBe(200);
    await daysPass(person.id, 60);
    expect(await refresh(aiApp)).toBe(true);

    await daysPass(person.id, 91);

    expect((await callMcp(aiApp.saved!.access_token)).status).toBe(401);
    expect(await refresh(aiApp)).toBe(false);
  });

  it("ends a deleted person's AI Connections", async () => {
    const admin = await addUser(db, { role: "admin" });
    const person = await signedInPerson();
    const aiApp = await connect(person.cookie);

    await deleteUser(db, admin, { userId: person.id });

    expect((await callMcp(aiApp.saved!.access_token)).status).toBe(401);
    expect(await refresh(aiApp)).toBe(false);
  });

  it("checks its person in the database on every call", async () => {
    const person = await signedInPerson();
    const token = (await connect(person.cookie)).saved!.access_token;
    expect((await callMcp(token)).status).toBe(200);

    await db.update(user).set({ banned: true }).where(eq(user.id, person.id));

    expect((await callMcp(token)).status).toBe(401);
  });

  it("serves only the OAuth routes of Better Auth", async () => {
    const otherRoutes = [
      new Request(`${APP}/api/auth/email-otp/send-verification-otp`, { method: "POST", body: "{}" }),
      new Request(`${APP}/api/auth/sign-in/email-otp`, { method: "POST", body: "{}" }),
      new Request(`${APP}/api/auth/oauth2/consent`, { method: "POST", body: "{}" }),
      new Request(`${APP}/api/auth/get-session`),
      new Request(`${APP}/api/auth/admin/list-users`),
    ];
    for (const request of otherRoutes) expect((await app(request)).status).toBe(404);
  });

  it("is not found anywhere while switched off", async () => {
    const off = routeTo(aiEndpoints({ db, auth, enabled: () => false, sendInvite: async () => "emailed" }));
    const person = await signedInPerson();
    const token = (await connect(person.cookie)).saved!.access_token;

    for (const path of [
      "/.well-known/oauth-protected-resource/mcp",
      "/.well-known/oauth-authorization-server/api/auth",
      "/api/auth/.well-known/openid-configuration",
      "/api/auth/oauth2/authorize",
    ]) {
      expect((await off(`${APP}${path}`)).status).toBe(404);
    }
    expect((await off(`${APP}/api/auth/oauth2/register`, { method: "POST", body: "{}" })).status).toBe(404);
    expect((await off(MCP, { method: "POST", headers: { authorization: `Bearer ${token}` } })).status).toBe(404);
  });
});

/** The app's routes, in-process: `/mcp` and everything Better Auth serves. */
function routeTo(endpoints: ReturnType<typeof aiEndpoints>): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    return new URL(request.url).pathname === "/mcp" ? endpoints.mcp(request) : endpoints.oauth(request);
  };
}
