"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { Settled } from "@/components/confirm";
import { commands, CommandError } from "@/server/commands";
import { flash } from "@/server/flash";
import { currentActor, refreshSession, signOutHere } from "@/server/auth";

export type NameState = { error?: string; saved?: boolean };

/** Colour preferences belong to the signed-in person, never a supplied user ID. */
export async function saveAvatarColour(_state: NameState, form: FormData): Promise<NameState> {
  const actor = await currentActor();
  const value = String(form.get("colour") ?? "");
  try {
    await commands.setOwnAvatarColour(actor, { colour: value === "" ? null : Number(value) });
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message };
    throw error;
  }
  await flash("Colour saved");
  refresh();
  return { saved: true };
}

/** Saves the name a person goes by; from the first-sign-in prompt, carries on to Events. */
export async function saveName(_state: NameState, form: FormData): Promise<NameState> {
  const actor = await currentActor();
  try {
    await commands.setOwnName(actor, { name: String(form.get("name") ?? "") });
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message };
    throw error;
  }
  // The cookie cache still holds the old name; renew it so every screen shows the new one.
  await refreshSession();
  if (form.get("then") === "events") redirect("/events");
  await flash("Name saved");
  refresh();
  return { saved: true };
}

/** Cuts one of the signed-in person's own AI Connections: never anyone else's. */
export async function disconnectAiConnection(_state: Settled, form: FormData): Promise<Settled> {
  const actor = await currentActor();
  try {
    await commands.disconnectAiConnection(actor, { clientId: String(form.get("clientId") ?? "") });
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message };
    throw error;
  }
  await flash("AI Connection disconnected");
  refresh();
  return { done: true };
}

export async function signOut() {
  await signOutHere();
  redirect("/sign-in");
}
