import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { mcp } from "@better-auth/mcp";
import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";

const DAY = 24 * 60 * 60;

/** Sends one sign-in code to one address. */
export type SendCodeEmail = (to: string, code: string) => Promise<void>;

export type AuthConfig = {
  db: Db;
  secret: string;
  baseURL: string;
  sendCodeEmail: SendCodeEmail;
};

/** Where AI apps reach Muse Inventory (ADR 0017), and what their tokens are for. */
export const mcpResource = (baseURL: string) => new URL("/mcp", baseURL).toString();

/**
 * How an AI Connection's tokens are stored: keyed, like sign-in codes, so
 * reading the database gives no working token away. `/mcp` finds a token by
 * the same hash.
 */
export function hashAiToken(secret: string, token: string) {
  return createHmac("sha256", secret).update(token).digest("base64url");
}

/**
 * Better Auth, invite-only, signed in by emailed code (ADR 0008). The app calls
 * its sign-in endpoints from Server Actions, so no raw Better Auth error ever
 * reaches the browser. The only public routes are AI Connections' OAuth ones
 * (ADR 0017), behind `AI_CONNECTIONS=1` (`app/api/auth`).
 */
export function createAuth({ db, secret, baseURL, sendCodeEmail }: AuthConfig) {
  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    user: { additionalFields: { avatarColour: { type: "number", required: false, input: false } } },
    // Rolling ~90-day sessions. Screens trust the signed cookie cache for up to
    // 5 minutes, so reading a session costs no database round trip; commands
    // re-check the session row every time (ADR 0008).
    session: {
      expiresIn: 90 * DAY,
      updateAge: DAY,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    plugins: [
      emailOTP({
        disableSignUp: true,
        otpLength: 6,
        expiresIn: 5 * 60,
        allowedAttempts: 3,
        // Keyed, because a plain hash of six digits is undone in a moment: reading
        // the database doesn't give away a code waiting to be entered.
        storeOTP: { hash: async (otp) => createHmac("sha256", secret).update(otp).digest("hex") },
        // Better Auth already sends nothing to an address it doesn't know. A
        // deactivated person gets nothing either, rather than a code that
        // would only meet "you have been banned" and give their account away.
        sendVerificationOTP: async ({ email, otp }) => {
          const [found] = await db
            .select({ banned: schema.user.banned })
            .from(schema.user)
            .where(eq(schema.user.email, email));
          if (found?.banned) return;
          await sendCodeEmail(email, otp);
        },
      }),
      admin(),
      // AI Connections (ADR 0017). An AI app registers itself (a Client ID
      // Metadata Document, or Dynamic Client Registration for apps that don't
      // host one yet), sends its person through sign-in and the Allow screen,
      // and gets tokens for `/mcp` alone. Access tokens are opaque, so `/mcp`
      // looks each one up, with its person, on every call.
      mcp({
        resource: mcpResource(baseURL),
        loginPage: "/sign-in",
        consentPage: "/connect",
        disableJwtPlugin: true,
        storeTokens: { hash: (token) => hashAiToken(secret, token) },
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        // Desktop and command-line apps register localhost callbacks.
        clientRegistrationDefaultApplicationType: "infer",
        // Lasts like a session, renewed each time the app refreshes its token.
        refreshTokenExpiresIn: 90 * DAY,
      }),
      cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
