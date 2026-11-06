import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { event, item, line, shortageAcknowledgement, shortageAcknowledgementEvent } from "@/db/schema";
import { todayInMuse } from "@/lib/time-zone";
import { CommandError } from "../errors";
import { countsOf, holdsMeeting } from "../loaders/availability";
import { shortages } from "../shortages";
import { ref, said } from "./activity";
import { defineCommand } from "./define";

// Only an Admin acknowledges a Shortage, saying how it will be covered. It
// clears the flag on every Event in the clash, each at its own Shortage as the
// numbers stand now: an Event's flag returns if its Shortage grows or an Event
// outside the clash joins it (ADR 0002).
export const acknowledgeShortage = defineCommand({
  name: "acknowledgeShortage",
  input: z.object({
    eventId: z.uuid("That Event no longer exists."),
    itemId: z.uuid("That item no longer exists."),
    note: z.string().trim().min(1, "Say how it will be covered."),
    // What the Admin was shown, so they never acknowledge a Shortage they haven't seen.
    shortBy: z.int(),
  }),
  allow: ["admin"],
  ai: false,
  run: async (tx, actor, { eventId, itemId, note, shortBy }, record) => {
    const today = todayInMuse();
    const [[thing], holds, counts] = await Promise.all([
      tx.select({ name: item.name, kind: item.kind }).from(item).where(eq(item.id, itemId)),
      holdsMeeting(tx, { from: today }, eq(line.itemId, itemId)),
      countsOf(tx, eq(item.id, itemId)),
    ]);
    if (!thing) throw new CommandError("invalid", "That item no longer exists.");
    const found = shortages(holds, counts, today);
    const shortage = found.find((s) => s.eventId === eventId);
    if (!shortage) throw new CommandError("invalid", `${thing.name} isn't short any more.`);
    if (shortage.shortBy !== shortBy) {
      throw new CommandError(
        "invalid",
        `It's now short by ${shortage.shortBy}. Check the Events again before acknowledging.`,
      );
    }

    // Every competing Event is short too, since it holds the item on a short day.
    // Each is held while this saves, so none is deleted under it; one deleted
    // since the holds were read changes the clash.
    const clash = [eventId, ...shortage.competing.map((h) => h.event.id)];
    const there = await tx.select({ id: event.id, name: event.name }).from(event).where(inArray(event.id, clash)).for("share");
    if (there.length < clash.length) {
      throw new CommandError("invalid", "The Events competing for it have changed. Check them again before acknowledging.");
    }
    const own = new Map(found.map((s) => [s.eventId, s.shortBy]));
    const [acknowledged] = await tx
      .insert(shortageAcknowledgement)
      .values({ itemId, note, byUserId: actor.userId })
      .returning({ id: shortageAcknowledgement.id });
    await tx.insert(shortageAcknowledgementEvent).values(
      clash.map((id) => ({
        acknowledgementId: acknowledged.id,
        eventId: id,
        shortBy: own.get(id)!,
      })),
    );
    const on = there.find((e) => e.id === eventId)!;
    await record("events", said`acknowledged ${ref.item(itemId, thing.name, thing.kind)} short by ${shortBy} on ${ref.event(on.id, on.name)}`);
    return acknowledged;
  },
});
