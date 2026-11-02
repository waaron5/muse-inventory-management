import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { event, line, item, shortageAcknowledgementEvent } from "@/db/schema";
import type { Tx } from "@/db/types";
import { CommandError } from "../errors";
import { holdEndedBefore } from "../hold-window";
import { remember } from "../deleted-records";
import { lineName } from "../loaders/lines";
import { museToday } from "../today";
import { ref, said } from "./activity";
import { defineCommand } from "./define";

// A Cancelled Event keeps its Lines as they were, holding nothing, so
// reinstating it brings every Reservation back; any Shortage that brings is
// flagged as usual (ADR 0002). Anyone can cancel or reinstate.

const anEvent = z.object({ id: z.uuid("That Event no longer exists.") });

/**
 * The Event, locked until this saves: a new Line or the giveaway holds it,
 * so none can slip in under a cancel or a delete.
 */
async function lockEvent(tx: Tx, id: string) {
  const [found] = await tx
    .select({ name: event.name, cancelledAt: event.cancelledAt, ended: sql<boolean>`coalesce(${holdEndedBefore(museToday)}, false)` })
    .from(event)
    .where(eq(event.id, id))
    .for("update");
  if (!found) throw new CommandError("invalid", "That Event no longer exists.");
  return { name: found.name, cancelled: found.cancelledAt !== null, ended: found.ended };
}

// Only before it ends: an Event that happened isn't Cancelled, and its Gifts
// are Given Away.
export const cancelEvent = defineCommand({
  name: "cancelEvent",
  input: anEvent,
  allow: ["admin", "user"],
  run: async (tx, _actor, { id }, record) => {
    const found = await lockEvent(tx, id);
    if (found.cancelled) throw new CommandError("invalid", "This Event is already Cancelled.");
    if (found.ended) throw new CommandError("invalid", "This Event has ended, so it can't be cancelled.");
    await tx.update(event).set({ cancelledAt: new Date() }).where(eq(event.id, id));
    await record("events", said`cancelled ${ref.event(id, found.name)}`);
  },
});

export const reinstateEvent = defineCommand({
  name: "reinstateEvent",
  input: anEvent,
  allow: ["admin", "user"],
  run: async (tx, _actor, { id }, record) => {
    const found = await lockEvent(tx, id);
    if (!found.cancelled) throw new CommandError("invalid", "This Event isn't Cancelled.");
    await tx.update(event).set({ cancelledAt: null }).where(eq(event.id, id));
    await record("events", said`reinstated ${ref.event(id, found.name)}`);
  },
});

// Delete the live Event; its History and past names remain (ADR 0011).
export const deleteEvent = defineCommand({
  name: "deleteEvent",
  input: anEvent,
  allow: ["admin"],
  run: async (tx, _actor, { id }, record) => {
    const found = await lockEvent(tx, id);
    await remember(tx, { id, kind: "event", name: found.name });
    const lines = await tx.select({ id: line.id, name: lineName }).from(line).leftJoin(item, eq(item.id, line.itemId)).where(eq(line.eventId, id));
    for (const entry of lines) await remember(tx, { ...entry, kind: "line", details: { eventId: id } });
    // An acknowledged Shortage stays acknowledged for the other Events in its clash.
    await tx.delete(shortageAcknowledgementEvent).where(eq(shortageAcknowledgementEvent.eventId, id));
    await tx.delete(line).where(eq(line.eventId, id));
    await tx.delete(event).where(eq(event.id, id));
    await record("events", said`deleted ${ref.event(id, found.name)}`);
  },
});
