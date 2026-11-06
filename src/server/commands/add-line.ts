import { eq } from "drizzle-orm";
import { z } from "zod";
import { event, line } from "@/db/schema";
import type { Tx } from "@/db/types";
import { CommandError } from "../errors";
import { ref, said } from "./activity";
import { defineCommand } from "./define";

// Anyone can add a Borrowed Item to an Event, entered by hand: it never enters
// the catalog, holds any Stock or has a price.

const typed = (label: string, missing: string) =>
  z.string().trim().min(1, missing).max(200, `Keep the ${label} under 200 characters.`);

const howMany = (fewest: string) => z.int("Enter a whole number.").min(1, fewest);

/**
 * The Event, refusing one that's gone or Cancelled, held while this saves so
 * it can't be cancelled under it.
 */
async function addable(tx: Tx, eventId: string) {
  const [found] = await tx.select({ name: event.name, cancelledAt: event.cancelledAt }).from(event).where(eq(event.id, eventId)).for("share");
  if (!found) throw new CommandError("invalid", "That Event no longer exists.");
  if (found.cancelledAt) throw new CommandError("invalid", "Reinstate the Event before adding to it.");
  return ref.event(eventId, found.name);
}

// A plain Line: a name, a count and its lender (ADR 0010).
export const addBorrowedItem = defineCommand({
  name: "addBorrowedItem",
  input: z.object({
    eventId: z.uuid("That Event no longer exists."),
    name: typed("name", "Say what was borrowed."),
    lender: z.string().trim().max(200, "Keep the lender under 200 characters.").default(""),
    count: howMany("Borrow at least 1."),
  }),
  allow: ["admin", "user"],
  ai: {
    description:
      "Adds a Borrowed Item to an Event: something borrowed for it from outside Muse, typed by name, with how many and who lent it. It never enters the catalog. For an Inventory Item or Gift, use reserve. For a list, call this once for each, then say which went through and which didn't.",
  },
  run: async (tx, actor, { eventId, name, lender, count }, record) => {
    const to = await addable(tx, eventId);
    const [added] = await tx
      .insert(line)
      .values({ eventId, kind: "borrowed", name, lender, reserved: count, addedByUserId: actor.userId })
      .returning({ id: line.id });
    await record("events", said`added ${count} ${name} (borrowed) to ${to}`);
    return added;
  },
});
