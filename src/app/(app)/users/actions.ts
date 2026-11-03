"use server";

import { refresh } from "next/cache";
import { appURL, currentActor } from "@/server/auth";
import { flash } from "@/server/flash";
import { commands, CommandError, type Role } from "@/server/commands";
import { type Delivery, inviteMailerFromEnv } from "@/server/mail";

/** What a Users sheet shows: a refusal and what was typed, or done. */
export type UsersFormState = {
  error?: string;
  done?: boolean;
  // Invited, but the email didn't go out, so the Admin tells them where to sign in.
  notEmailed?: { email: string; appURL: string };
};

const sendInvite = inviteMailerFromEnv(appURL);

// A laptop without a Resend key only writes to the outbox, so it never says "emailed".
const INVITED: Record<Delivery, string> = {
  emailed: "Invite emailed",
  outbox: "Invited, not emailed: it's in .outbox/mail.jsonl",
  failed: "Invited",
};

export async function invite(_state: UsersFormState, form: FormData): Promise<UsersFormState> {
  const actor = await currentActor();
  const text = (key: string) => String(form.get(key) ?? "");
  let email: string;
  try {
    ({ email } = await commands.inviteUser(actor, { email: text("email") }));
  } catch (error) {
    // The email field keeps what was typed itself.
    if (error instanceof CommandError) return { error: error.message };
    throw error;
  }
  const delivery = await sendInvite(email);
  await flash(INVITED[delivery]);
  refresh();
  return delivery === "failed" ? { done: true, notEmailed: { email, appURL } } : { done: true };
}

export async function changeRole(_state: UsersFormState, form: FormData): Promise<UsersFormState> {
  const actor = await currentActor();
  const userId = String(form.get("userId") ?? "");
  return settled("Role changed", () => commands.changeRole(actor, { userId, role: roleFrom(form) }));
}

export async function deactivate(_state: UsersFormState, form: FormData): Promise<UsersFormState> {
  const actor = await currentActor();
  const userId = String(form.get("userId") ?? "");
  return settled("Deactivated", () => commands.deactivateUser(actor, { userId }));
}

export async function reactivate(_state: UsersFormState, form: FormData): Promise<UsersFormState> {
  const actor = await currentActor();
  return settled("Reactivated", () => commands.reactivateUser(actor, { userId: String(form.get("userId") ?? "") }));
}

export async function deleteUser(_state: UsersFormState, form: FormData): Promise<UsersFormState> {
  const actor = await currentActor();
  const userId = String(form.get("userId") ?? "");
  return settled("User deleted", () => commands.deleteUser(actor, { userId }));
}

// Says `done` in a snackbar once the change has committed.
async function settled(done: string, change: () => Promise<unknown>): Promise<UsersFormState> {
  try {
    await change();
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message };
    throw error;
  }
  await flash(done);
  refresh();
  return { done: true };
}

// Checked by the command, which refuses anything but the two roles.
function roleFrom(form: FormData) {
  return String(form.get("role") ?? "") as Role;
}
