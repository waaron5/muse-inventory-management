import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { event, item, line } from "@/db/schema";
import type { ActivityPart } from "@/lib/activity";
import { formatDays } from "@/lib/format";
import type { Tx } from "@/db/types";
import { CommandError } from "../errors";
import { holdWindow } from "../hold-window";
import { listed, ref, said } from "./activity";
import { defineCommand } from "./define";
import { checkDates, checkPlCodeFree, eventFields, resolveClient } from "./event-fields";

// Anyone can change any Event, so a colleague can cover for them.
export const editEvent = defineCommand({
  name: "editEvent",
  input: z.object({ id: z.uuid("That Event no longer exists."), ...eventFields }),
  allow: ["admin", "user"],
  ai: {
    description:
      "Changes an Event's details. Only the fields given change; send an empty string to clear one. New dates move what it holds, and any Shortage they cause is flagged; its dates can't be cleared while it holds Inventory.",
  },
  run: async (tx, _actor, { id, client, ...fields }, record) => {
    const [current] = await tx
      .select({
        name: event.name,
        clientId: event.clientId,
        plCode: event.plCode,
        venue: event.venue,
        notes: event.notes,
        startsOn: event.startsOn,
        endsOn: event.endsOn,
      })
      .from(event)
      .where(eq(event.id, id))
      .for("update");
    if (!current) throw new CommandError("invalid", "That Event no longer exists.");
    checkDates(fields);
    // New dates move the Event's holds, but an Inventory Item can't be held without any.
    if (!holdWindow(fields) && (await holdsInventory(tx, id))) {
      throw new CommandError("invalid", "Remove the Event's Inventory before clearing its dates.");
    }
    await checkPlCodeFree(tx, fields.plCode, id);
    const picked = await resolveClient(tx, client, current.clientId);
    await tx
      .update(event)
      .set({ ...fields, clientId: picked.id })
      .where(eq(event.id, id));
    // Only what changed, as it is now; long text only says that it changed.
    const to = (value: string | null) => value ?? "none";
    const changes: ActivityPart[][] = [];
    if (fields.name !== current.name) changes.push(said`name to ${fields.name}`);
    if (picked.id !== current.clientId) changes.push(said`Client to ${ref.client(picked.id, picked.name)}`);
    if (fields.startsOn !== current.startsOn || fields.endsOn !== current.endsOn) {
      changes.push(said`dates to ${fields.startsOn || fields.endsOn ? formatDays(fields.startsOn, fields.endsOn) : "none"}`);
    }
    if (fields.plCode !== current.plCode) changes.push(said`P&L Code to ${to(fields.plCode)}`);
    if (fields.venue !== current.venue) changes.push(said`Venue to ${to(fields.venue)}`);
    if (fields.notes !== current.notes) changes.push(["notes"]);
    await record("events", changes.length ? said`changed ${ref.event(id, current.name)}'s ${listed(changes)}` : null);
    return { id };
  },
});

async function holdsInventory(tx: Tx, eventId: string) {
  const held = await tx
    .select({ id: line.id })
    .from(line)
    .innerJoin(item, eq(item.id, line.itemId))
    .where(and(eq(line.eventId, eventId), eq(item.kind, "inventory")))
    .limit(1);
  return held.length > 0;
}
