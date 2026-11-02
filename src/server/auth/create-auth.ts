import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
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

/**
 * Better Auth, invite-only, signed in by emailed code (ADR 0008). There is no
 * public auth route: the app calls these endpoints from Server Actions, so no
 * raw Better Auth error ever reaches the browser.
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
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
