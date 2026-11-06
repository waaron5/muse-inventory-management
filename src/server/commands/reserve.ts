import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { event, item, line } from "@/db/schema";
import { CommandError } from "../errors";
import { datedColumns, holdWindow } from "../hold-window";
import { ref, said } from "./activity";
import { defineCommand } from "./define";

// Anyone can reserve. It takes effect at once, with no approval, even when it
// asks for more than is Available: a Shortage is flagged, never blocked (ADR 0002).
export const reserve = defineCommand({
  name: "reserve",
  input: z.object({
    eventId: z.uuid("That Event no longer exists."),
    itemId: z.uuid("Pick something to reserve."),
    count: z.int("Enter a whole number.").min(1, "Reserve at least 1."),
  }),
  allow: ["admin", "user"],
  ai: {
    description:
      "Reserves an Inventory Item or Gift for an Event, at once. Reserving one the Event already has adds to its Line. More than is Available still saves: the Shortage is flagged, and this says so. Inventory can only be reserved for an Event with dates. For a list, call this once for each, then say which went through and which didn't.",
  },
  run: async (tx, actor, { eventId, itemId, count }, record) => {
    // Held while this saves, so the Event's dates can't be cleared under it.
    const [found] = await tx
      .select({ name: event.name, cancelledAt: event.cancelledAt, ...datedColumns })
      .from(event)
      .where(eq(event.id, eventId))
      .for("share");
    if (!found) throw new CommandError("invalid", "That Event no longer exists.");
    if (found.cancelledAt) throw new CommandError("invalid", "Reinstate the Event before reserving for it.");

    // Held too, so it can't be Archived under this.
    const [thing] = await tx
      .select({ kind: item.kind, name: item.name, archivedAt: item.archivedAt })
      .from(item)
      .where(eq(item.id, itemId))
      .for("share");
    if (!thing) throw new CommandError("invalid", "Pick something to reserve.");
    if (thing.archivedAt) throw new CommandError("invalid", `${thing.name} is Archived, so it can't be reserved.`);
    // An Inventory Item holds across the Hold Window; a Gift holds whatever the dates.
    if (thing.kind === "inventory" && !holdWindow(found)) {
      throw new CommandError("invalid", "Give the Event its dates before reserving Inventory.");
    }

    const [reserved] = await tx
      .insert(line)
      .values({ eventId, itemId, reserved: count, addedByUserId: actor.userId })
      .onConflictDoUpdate({
        target: [line.eventId, line.itemId],
        set: { reserved: sql`${line.reserved} + excluded.reserved` },
      })
      .returning({ id: line.id, reserved: line.reserved });
    // Reserving it again raises the Line already there.
    const more = reserved.reserved > count ? "more " : "";
    await record("events", said`reserved ${count} ${more}${ref.item(itemId, thing.name, thing.kind)} for ${ref.event(eventId, found.name)}`);
    return { id: reserved.id };
  },
});
