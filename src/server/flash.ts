import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { type Flash, flashCookie, parseFlash } from "@/lib/flash";

/**
 * Confirms a change with a snackbar on whatever screen comes next. Call it
 * only after the command has committed, so it never claims a change that
 * didn't happen. Setting a cookie re-renders the page, as `refresh()` and
 * `redirect()` do anyway, and the shell's Toaster reads it there.
 */
export async function flash(message: string) {
  const value = JSON.stringify({ id: randomUUID(), message } satisfies Flash);
  (await cookies()).set(flashCookie, value, { path: "/", maxAge: 60, sameSite: "lax" });
}

/** The message waiting to be shown, if any. */
export async function readFlash() {
  return parseFlash((await cookies()).get(flashCookie)?.value);
}
