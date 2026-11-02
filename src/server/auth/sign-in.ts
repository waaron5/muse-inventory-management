import { APIError } from "better-auth/api";
import type { Auth } from "./create-auth";
import type { SignInLimits } from "./sign-in-limits";

const TOO_MANY_TRIES = "Too many tries. Wait a while and try again.";

export type SignInResult =
  | { ok: true; cookie: Headers; needsName: boolean }
  | { ok: false; message: string };

/** Emails a sign-in code to an invited address. */
export async function sendCode(auth: Auth, email: string): Promise<void> {
  await auth.api.sendVerificationOTP({ body: { email: normalize(email), type: "sign-in" } });
}

/**
 * Signs in with an emailed code; on success, `cookie` carries the new session,
 * and `needsName` says the person has yet to say what they're called.
 * Every refusal reads the same, so nobody can learn which addresses are invited.
 */
export async function signIn(auth: Auth, email: string, code: string): Promise<SignInResult> {
  try {
    const { headers, response } = await auth.api.signInEmailOTP({
      body: { email: normalize(email), otp: code },
      returnHeaders: true,
    });
    return { ok: true, cookie: toCookie(headers), needsName: !response.user.name };
  } catch (error) {
    if (error instanceof APIError) {
      return { ok: false, message: "That code didn't work. Check your latest email, or send a new code." };
    }
    throw error;
  }
}

/**
 * Sending and checking codes, each within the sign-in limits. A refusal reads
 * the same for everyone, and a right code is refused too once a limit is
 * reached, or the limit would mean nothing.
 */
export function limitedSignIn(auth: Auth, limits: SignInLimits) {
  return {
    async send(email: string, ip: string | null): Promise<{ ok: true } | { ok: false; message: string }> {
      const { allowed } = await limits.take("send", normalize(email), ip);
      if (!allowed) return { ok: false, message: TOO_MANY_TRIES };
      await sendCode(auth, email);
      return { ok: true };
    },
    async verify(email: string, code: string, ip: string | null): Promise<SignInResult> {
      const { allowed, giveBack } = await limits.take("guess", normalize(email), ip);
      if (!allowed) return { ok: false, message: TOO_MANY_TRIES };
      const result = await signIn(auth, email, code);
      if (result.ok) await giveBack();
      return result;
    },
  };
}

// Invited addresses are stored lower-case; people type them however they like.
function normalize(email: string) {
  return email.trim().toLowerCase();
}

// Turns a response's Set-Cookie into the Cookie a later request would send.
function toCookie(responseHeaders: Headers): Headers {
  const pairs = responseHeaders.getSetCookie().map((line) => line.split(";")[0]);
  return new Headers({ cookie: pairs.join("; ") });
}
