"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { continueConnecting } from "@/server/ai";
import { signInByCode, signInToTheDemo } from "@/server/auth";

export type SignInState = { step: "email" | "code"; email: string; error?: string; resent?: boolean };

const email = z.string().trim().pipe(z.email());

/**
 * Step one emails a code; step two signs in with it, sends a new one, or goes
 * back to change the address.
 */
export async function signInStep(state: SignInState, form: FormData): Promise<SignInState> {
  const intent = form.get("intent");

  if (intent === "change") return { step: "email", email: state.email };

  if (intent === "resend") {
    const sent = await signInByCode.send(state.email);
    if (!sent.ok) return { ...state, error: sent.message, resent: false };
    return { step: "code", email: state.email, resent: true };
  }

  if (intent === "send") {
    const typed = String(form.get("email") ?? "");
    const parsed = email.safeParse(typed);
    if (!parsed.success) return { step: "email", email: typed, error: "Enter your email address." };
    const sent = await signInByCode.send(parsed.data);
    if (!sent.ok) return { step: "email", email: parsed.data, error: sent.message };
    return { step: "code", email: parsed.data };
  }

  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  const result = await signInByCode.verify(state.email, code);
  if (!result.ok) return { ...state, error: result.message, resent: false };
  // On the way to connecting an AI app, its Allow screen is next. Otherwise, as
  // an action's redirect skips the proxy, the name prompt is chosen here too.
  const connecting = await continueConnecting(String(form.get("connecting") ?? ""));
  redirect(connecting ?? (result.needsName ? "/welcome" : "/events"));
}

/** The demo's one button (ADR 0016): signed in as its Admin, straight to Events. */
export async function signInToDemo(): Promise<{ error?: string }> {
  await signInToTheDemo();
  redirect("/events");
}
