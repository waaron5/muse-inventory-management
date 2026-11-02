"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signInByCode } from "@/server/auth";

export type SignInState = { step: "email" | "code"; email: string; error?: string };

const email = z.string().trim().pipe(z.email());

/** Step one emails a code; step two signs in with it. */
export async function signInStep(state: SignInState, form: FormData): Promise<SignInState> {
  if (form.get("intent") === "send") {
    const typed = String(form.get("email") ?? "");
    const parsed = email.safeParse(typed);
    if (!parsed.success) return { step: "email", email: typed, error: "Enter your email address." };
    const sent = await signInByCode.send(parsed.data);
    if (!sent.ok) return { step: "email", email: parsed.data, error: sent.message };
    return { step: "code", email: parsed.data };
  }

  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const result = await signInByCode.verify(state.email, code);
  if (!result.ok) return { ...state, error: result.message };
  // An action's redirect skips the proxy, so the name prompt is chosen here too.
  redirect(result.needsName ? "/welcome" : "/events");
}
