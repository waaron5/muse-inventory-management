import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { client, deletedRecord, event } from "@/db/schema";
import type { Tx } from "@/db/types";
import { clientColour } from "@/lib/client-colour";
import { CommandError } from "../errors";
import { optionalText } from "./item-fields";

// The fields someone types for an Event, shared by create and edit.

/** A Client's name as typed, its spacing tidied; `empty` says what to do when there's none. */
export const clientName = (empty: string) =>
  z
    .string()
    .trim()
    .min(1, empty)
    .max(200, "Keep the Client's name under 200 characters.")
    .transform((name) => name.replace(/\s+/g, " "));

// A Client picked from the list, or added inline by name.
const pickedClient = z.union([
  z.object({ id: z.uuid("Pick a Client that's still there.") }),
  z.object({ name: clientName("Pick or add a Client.") }),
], { error: "Pick or add a Client." });

// A calendar day in Muse's time zone (ADR 0005); a blank date field is "not set".
const day = (message: string) =>
  z
    .union([z.iso.date(message), z.literal("")])
    .optional()
    .transform((value) => value || null);

export const eventFields = {
  name: z.string().trim().min(1, "Give the Event a name.").max(200, "Keep the name under 200 characters."),
  client: pickedClient,
  plCode: optionalText(100, "Keep the P&L Code under 100 characters."),
  venue: optionalText(200, "Keep the Venue under 200 characters."),
  notes: optionalText(10000, "Keep the Notes under 10,000 characters."),
  startsOn: day("Enter the start date."),
  endsOn: day("Enter the end date."),
};

/** Refuses dates out of order. */
export function checkDates(e: { startsOn: string | null; endsOn: string | null }) {
  if (e.startsOn && e.endsOn && e.endsOn < e.startsOn) {
    throw new CommandError("invalid", "The Event can't end before it starts.");
  }
}

/** Refuses a P&L Code another Event already has; the unique index backs this up. */
export async function checkPlCodeFree(tx: Tx, plCode: string | null, eventId?: string) {
  if (plCode === null) return;
  const taken = await tx.$count(
    event,
    and(eq(sql`lower(${event.plCode})`, plCode.toLowerCase()), eventId ? ne(event.id, eventId) : undefined),
  );
  if (taken > 0) throw new CommandError("invalid", `Another Event already has the P&L Code ${plCode}.`);
}

/**
 * The picked Client, adding it first when it's new. Held while this
 * saves, so it can't be merged away under the Event. An Archived Client picked
 * for an Event is back in use, unless the Event was already its (`current`).
 */
export async function resolveClient(tx: Tx, picked: z.output<typeof pickedClient>, current?: string) {
  if (current && "name" in picked) {
    const [saved] = await tx.select({ name: deletedRecord.name }).from(deletedRecord).where(and(eq(deletedRecord.id, current), eq(deletedRecord.kind, "client")));
    if (saved?.name.toLowerCase() === picked.name.toLowerCase()) return { id: current, name: saved.name };
  }
  // Typed again, a Client's name finds the one already there rather than a duplicate.
  if ("name" in picked) await tx.insert(client).values({ name: picked.name, colour: clientColour(picked.name) }).onConflictDoNothing();
  const [found] = await tx
    .select({ id: client.id, name: client.name, archived: sql<boolean>`${client.archivedAt} is not null` })
    .from(client)
    .where("id" in picked ? eq(client.id, picked.id) : eq(sql`lower(${client.name})`, picked.name.toLowerCase()))
    .for("share");
  if (!found) throw new CommandError("invalid", "Pick a Client that's still there.");
  if (found.archived && found.id !== current) {
    await tx.update(client).set({ archivedAt: null }).where(eq(client.id, found.id));
  }
  return { id: found.id, name: found.name };
}
