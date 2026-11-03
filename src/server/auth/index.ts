import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { isDemo } from "@/lib/demo";
import { codeMailerFromEnv } from "../mail";
import { DEMO_ADMIN, ensureDemoAdmin } from "../demo/seed";
import { createAuth } from "./create-auth";
import { readSession } from "./session";
import { limitedSignIn, signIn } from "./sign-in";
import { createSignInLimits } from "./sign-in-limits";

/** Where the app is served, as invite emails name it. */
export const appURL = process.env.BETTER_AUTH_URL ?? deployedURL() ?? "http://localhost:3000";

/** Better Auth, bound to the app's database, mailer and config. */
export const auth = createAuth({
  db,
  secret: authSecret(),
  baseURL: appURL,
  sendCodeEmail: codeMailerFromEnv(),
});

// A fixed secret is fine on a laptop; anywhere on Vercel it must be set.
function authSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.VERCEL) throw new Error("BETTER_AUTH_SECRET is not set.");
  return "local-only-secret-never-used-by-a-deployed-app";
}

function deployedURL() {
  const host =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL;
  return host ? `https://${host}` : undefined;
}

/** The signed-in person, from the cookie cache. For showing things only. */
export const currentSession = cache(async () => readSession(auth, await requestCookies()));

// Read through cookies() rather than headers(): after a Server Action renews the
// cookie cache, the page it re-renders sees the renewed cookie, not the old one.
async function requestCookies() {
  return new Headers({ cookie: (await cookies()).toString() });
}

/** Who is acting, for a Server Action to hand its command; signed out goes to sign-in. */
export async function currentActor() {
  const session = await currentSession();
  if (!session) redirect("/sign-in");
  return session.actor;
}

const limits = createSignInLimits(db, authSecret());
const withinLimits = limitedSignIn(auth, limits);

export const signInByCode = {
  send: async (email: string) => withinLimits.send(email, await clientIp()),
  verify: async (email: string, code: string) => withinLimits.verify(email, code, await clientIp()),
};

/**
 * The demo's one-click sign-in (ADR 0016), as its fictional Admin, put back
 * first in case a visitor changed them. It makes the code itself rather than
 * emailing it, so it only ever runs in the demo.
 */
export async function signInToTheDemo() {
  if (!isDemo()) throw new Error("Demo sign-in is off outside the demo.");
  await ensureDemoAdmin(db);
  const code = await auth.api.createVerificationOTP({ body: { email: DEMO_ADMIN.email, type: "sign-in" } });
  const result = await signIn(auth, DEMO_ADMIN.email, code);
  if (!result.ok) throw new Error(result.message);
}

/** Clears finished sign-in counts. */
export const forgetEndedSignInCounts = () => limits.forgetEnded();

// Only Vercel sets this, and it can't be sent from outside. Off Vercel there is
// no IP to trust, so only the limits on each address apply.
async function clientIp() {
  return (await headers()).get("x-vercel-forwarded-for")?.split(",")[0].trim() || null;
}

/** Re-reads the session from the database, so the cookie cache shows a change at once. */
export async function refreshSession() {
  await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
}

/** Ends this device's session and clears its cookies. */
export async function signOutHere() {
  await auth.api.signOut({ headers: await headers() });
}

/**
 * The session check every screen passes through (in the proxy). Inside the
 * 5-minute cookie cache this reads no database; after it, one lookup renews the
 * cache, and `setCookie` carries the renewed cookies for the response.
 */
export async function checkAtTheDoor(requestHeaders: Headers) {
  const { response, headers: responseHeaders } = await auth.api.getSession({
    headers: requestHeaders,
    returnHeaders: true,
  });
  const user = response && !response.user.banned ? response.user : null;
  return { user, setCookie: responseHeaders.getSetCookie() };
}
