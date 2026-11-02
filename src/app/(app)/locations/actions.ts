"use server";

import { refresh } from "next/cache";
import { currentActor } from "@/server/auth";
import { flash } from "@/server/flash";
import { commands, CommandError } from "@/server/commands";

/** What a Locations sheet shows: a refusal, or done. */
export type LocationsFormState = { error?: string; done?: boolean };

export async function deleteLocation(_state: LocationsFormState, form: FormData): Promise<LocationsFormState> {
  const actor = await currentActor();
  return settled("Location deleted", () => commands.deleteLocation(actor, { id: String(form.get("locationId") ?? "") }));
}

/** Anyone can add a Location. */
export async function addLocation(_state: LocationsFormState, form: FormData): Promise<LocationsFormState> {
  const actor = await currentActor();
  return settled("Location added", () => commands.createLocation(actor, { name: String(form.get("name") ?? "") }));
}

export async function renameLocation(_state: LocationsFormState, form: FormData): Promise<LocationsFormState> {
  const actor = await currentActor();
  const text = (key: string) => String(form.get(key) ?? "");
  return settled("Location renamed", () => commands.renameLocation(actor, { locationId: text("locationId"), name: text("name") }));
}

// Says `done` in a snackbar once the change has committed.
async function settled(done: string, change: () => Promise<unknown>): Promise<LocationsFormState> {
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
