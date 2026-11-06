import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import type { Auth } from "../auth/create-auth";
import { UNNAMED_APP } from "../auth/ai-tokens";

// Connecting an AI app (ADR 0017). Its OAuth request reaches sign-in and the
// Allow screen as a signed query, so nothing in it can be changed on the way.

/** What the Allow screen shows: the app, by the name it gave, and where it returns to. */
export type ConnectRequest = { appName: string; returnsTo: string };

/**
 * The Allow screen's request, or null when it was changed, has expired or names
 * an app that's gone. The app chose its own name, so the screen also shows the
 * host it will return to.
 */
export async function readConnectRequest(auth: Auth, params: URLSearchParams, headers: Headers): Promise<ConnectRequest | null> {
  const query = signedPart(params);
  if (!(await isSigned(auth, query))) return null;
  try {
    const client = await auth.api.getOAuthClientPublic({ query: { client_id: query.get("client_id") ?? "" }, headers });
    return { appName: client.client_name?.trim() || UNNAMED_APP, returnsTo: new URL(query.get("redirect_uri") ?? "").hostname };
  } catch (error) {
    if (error instanceof APIError || error instanceof TypeError) return null;
    throw error;
  }
}

/** Allow or Cancel: where to send the person next, back to their app. */
export async function answerConnectRequest(auth: Auth, headers: Headers, search: string, accept: boolean): Promise<string> {
  const oauth_query = signedPart(new URLSearchParams(search)).toString();
  // Allow carries on with the authorization, which reads the request it came in on.
  const request = new Request(new URL("/api/auth/oauth2/consent", auth.options.baseURL as string), { method: "POST", headers });
  const { url } = await auth.api.oauth2Consent({ body: { accept, oauth_query }, headers, request, asResponse: false });
  return url;
}

/**
 * After signing in on the way to connecting an app, where the authorization
 * picks up again; null when sign-in wasn't reached that way.
 */
export async function continueAfterSignIn(auth: Auth, search: string): Promise<string | null> {
  const query = signedPart(new URLSearchParams(search));
  if (!(await isSigned(auth, query))) return null;
  for (const own of ["sig", "exp", "ba_iat", "ba_pl", "ba_param"]) query.delete(own);
  // A request to sign in again has just been met.
  const prompt = query.get("prompt")?.split(" ").filter((p) => p && p !== "login");
  if (prompt?.length) query.set("prompt", prompt.join(" "));
  else query.delete("prompt");
  return `/api/auth/oauth2/authorize?${query}`;
}

async function isSigned(auth: Auth, query: URLSearchParams) {
  return verifyOAuthQueryParams(query.toString(), (await auth.$context).secret);
}

// Only the parameters Better Auth signed: a page's own are left out.
function signedPart(params: URLSearchParams) {
  const signed = new Set(["sig", "ba_param", ...params.getAll("ba_param")]);
  return new URLSearchParams([...params].filter(([key]) => signed.has(key)));
}
