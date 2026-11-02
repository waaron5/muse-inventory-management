"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { currentActor } from "@/server/auth";
import { commands, CommandError } from "@/server/commands";
import { flash } from "@/server/flash";
import { backTo } from "@/lib/back-to";

/** What the Event form shows after a refusal: the reason, and what was typed. */
export type EventFormState = { error?: string; values?: Record<string, string> };

export async function createEvent(_state: EventFormState, form: FormData): Promise<EventFormState> {
  const actor = await currentActor();
  let id: string;
  try {
    ({ id } = await commands.createEvent(actor, eventFieldsFrom(form)));
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message, values: typed(form) };
    throw error;
  }
  await flash("Event added");
  redirect(`/events/${id}`);
}

export async function editEvent(_state: EventFormState, form: FormData): Promise<EventFormState> {
  const actor = await currentActor();
  const id = String(form.get("id") ?? "");
  try {
    await commands.editEvent(actor, { id, ...eventFieldsFrom(form) });
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message, values: typed(form) };
    throw error;
  }
  await flash("Changes saved");
  redirect(backTo(form, `/events/${id}`));
}

// Anyone can cancel an Event before it ends, and reinstate it.
export async function cancelEvent(_state: LineFormState, form: FormData): Promise<LineFormState> {
  const actor = await currentActor();
  return settled(form, "Event cancelled", () => commands.cancelEvent(actor, { id: String(form.get("id") ?? "") }));
}

export async function reinstateEvent(_state: LineFormState, form: FormData): Promise<LineFormState> {
  const actor = await currentActor();
  return settled(form, "Event reinstated", () => commands.reinstateEvent(actor, { id: String(form.get("id") ?? "") }));
}

// Only an Admin; historical snapshots retain its past records.
export async function deleteEvent(_state: LineFormState, form: FormData): Promise<LineFormState> {
  const actor = await currentActor();
  try {
    await commands.deleteEvent(actor, { id: String(form.get("id") ?? "") });
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message };
    throw error;
  }
  await flash("Event deleted");
  redirect(backTo(form, "/events"));
}

/** What a Line form shows: a refusal and what was typed, or done. */
export type LineFormState = { error?: string; values?: Record<string, string>; done?: boolean };

// From the Event's picker, or Reserve for an event… on an item's page.
export async function reserve(_state: LineFormState, form: FormData): Promise<LineFormState> {
  const actor = await currentActor();
  const text = (key: string) => String(form.get(key) ?? "");
  return settled(form, "Reserved", () =>
    commands.reserve(actor, { eventId: text("eventId"), itemId: text("itemId"), count: typedNumber(text("count")) }),
  );
}

// Entered by hand under the Event's Inventory, as non-inventory.
export async function addBorrowedItem(_state: LineFormState, form: FormData): Promise<LineFormState> {
  const actor = await currentActor();
  const text = (key: string) => String(form.get(key) ?? "");
  return settled(form, "Borrowed Item added", () =>
    commands.addBorrowedItem(actor, {
      eventId: text("eventId"),
      name: text("name"),
      lender: text("lender"),
      count: typedNumber(text("count")),
    }),
  );
}

export async function changeReserved(_state: LineFormState, form: FormData): Promise<LineFormState> {
  const actor = await currentActor();
  const text = (key: string) => String(form.get(key) ?? "");
  return settled(form, "Count changed", () => commands.changeReserved(actor, { lineId: text("lineId"), count: typedNumber(text("count")) }));
}

export async function removeLine(_state: LineFormState, form: FormData): Promise<LineFormState> {
  const actor = await currentActor();
  return settled(form, "Removed", () => commands.removeLine(actor, { lineId: String(form.get("lineId") ?? "") }));
}

// An Admin's note on how a Shortage will be covered.
export async function acknowledgeShortage(_state: LineFormState, form: FormData): Promise<LineFormState> {
  const actor = await currentActor();
  const text = (key: string) => String(form.get(key) ?? "");
  return settled(form, "Shortage acknowledged", () =>
    commands.acknowledgeShortage(actor, {
      eventId: text("eventId"),
      itemId: text("itemId"),
      note: text("note"),
      shortBy: typedNumber(text("shortBy")),
    }),
  );
}

// Says `done` in a snackbar once the change has committed.
async function settled(form: FormData, done: string, change: () => Promise<unknown>): Promise<LineFormState> {
  try {
    await change();
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message, values: typed(form) };
    throw error;
  }
  await flash(done);
  refresh();
  return { done: true };
}

// Left blank is no number at all, so it's refused rather than read as 0.
function typedNumber(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value);
}

// The Client is typed or picked by name: a name already there is that Client.
function eventFieldsFrom(form: FormData) {
  const text = (key: string) => String(form.get(key) ?? "");
  return {
    name: text("name"),
    client: { name: text("client") },
    plCode: text("plCode"),
    venue: text("venue"),
    startsOn: text("startsOn"),
    endsOn: text("endsOn"),
    notes: text("notes"),
  };
}

function typed(form: FormData) {
  return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
}
