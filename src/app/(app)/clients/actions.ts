"use server";

import { refresh } from "next/cache";
import { currentActor } from "@/server/auth";
import { flash } from "@/server/flash";
import { commands, CommandError } from "@/server/commands";

/** What a Clients sheet shows: a refusal, or done. */
export type ClientsFormState = { error?: string; done?: boolean };

export async function addClient(_state: ClientsFormState, form: FormData): Promise<ClientsFormState> {
  const actor = await currentActor();
  return settled("Client added", () => commands.createClient(actor, { name: String(form.get("name") ?? "") }));
}

export async function deleteClient(_state: ClientsFormState, form: FormData): Promise<ClientsFormState> {
  const actor = await currentActor();
  return settled("Client deleted", () => commands.deleteClient(actor, { id: String(form.get("clientId") ?? "") }));
}

export async function renameClient(_state: ClientsFormState, form: FormData): Promise<ClientsFormState> {
  const actor = await currentActor();
  const text = (key: string) => String(form.get(key) ?? "");
  return settled("Client renamed", () => commands.renameClient(actor, { clientId: text("clientId"), name: text("name") }));
}

export async function saveClientColour(_state: ClientsFormState, form: FormData): Promise<ClientsFormState> {
  const actor = await currentActor();
  return settled("Client colour saved", () => commands.setClientColour(actor, {
    clientId: String(form.get("clientId") ?? ""),
    colour: String(form.get("colour") ?? ""),
  }));
}

export async function mergeClients(_state: ClientsFormState, form: FormData): Promise<ClientsFormState> {
  const actor = await currentActor();
  const text = (key: string) => String(form.get(key) ?? "");
  return settled("Clients merged", () =>
    commands.mergeClients(actor, { clientId: text("clientId"), intoClientId: text("intoClientId") }),
  );
}

export async function archiveClient(_state: ClientsFormState, form: FormData): Promise<ClientsFormState> {
  const actor = await currentActor();
  return settled("Client archived", () => commands.archiveClient(actor, { clientId: String(form.get("clientId") ?? "") }));
}

export async function unarchiveClient(_state: ClientsFormState, form: FormData): Promise<ClientsFormState> {
  const actor = await currentActor();
  return settled("Client unarchived", () => commands.unarchiveClient(actor, { clientId: String(form.get("clientId") ?? "") }));
}

// Says `done` in a snackbar once the change has committed.
async function settled(done: string, change: () => Promise<unknown>): Promise<ClientsFormState> {
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
