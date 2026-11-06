import { eq } from "drizzle-orm";
import { z } from "zod";
import { historyEntry, item } from "@/db/schema";
import { CommandError } from "../errors";
import { museToday } from "../today";
import { ref, said } from "./activity";
import { defineCommand } from "./define";
import { happenedOn } from "./happened-on";
import { lockItemStock, locationName, putStock, takeStock } from "./stock";

const takes = ["lost", "damaged", "given-away"] as const;
// What anyone may record; the rest are an Admin's.
const anyone = ["found", "given-away"] as const;

const note = z
  .string()
  .trim()
  .max(1000, "Keep the note under 1,000 characters.")
  .optional()
  .transform((value) => value || null);

const where = { itemId: z.uuid(), note, happenedOn };

const count = z.int("Enter a whole number.").min(1, "Adjust by at least 1.");

// A change to an item's Stock, at its Location, outside any Event, always with a reason.
// Purchased and Found add to it, Lost and Damaged take from it, and a Recount
// sets it to what was counted. A Gift handed out outside any Event is Given
// away, noting who it went to. Anyone can record Found or Given away.
export const adjustStock = defineCommand({
  name: "adjustStock",
  input: z.discriminatedUnion(
    "reason",
    [
      z.object({
        ...where,
        reason: z.enum(["purchased", "found", "lost", "damaged"]),
        count,
      }),
      z.object({
        ...where,
        reason: z.literal("given-away"),
        count,
        note: z
          .string("Note who it went to.")
          .trim()
          .min(1, "Note who it went to.")
          .max(1000, "Keep the note under 1,000 characters."),
      }),
      z.object({
        ...where,
        reason: z.literal("recount"),
        countedTo: z.int("Enter a whole number.").min(0, "A count can't be less than 0."),
      }),
    ],
    "Pick a reason.",
  ),
  allow: ["admin", "user"],
  ai: {
    description:
      "Changes an item's Stock at its Location outside any Event, always with a reason. purchased and found add count; lost and damaged take count away; recount sets it to countedTo, what was counted; given-away hands out a Gift outside any Event, with a note of who it went to. Anyone can record found or given-away; the rest are an Admin's. happenedOn is the day it happened, today when left out, never a day still to come. For a list, call this once for each, then say which went through and which didn't.",
  },
  run: async (tx, actor, input, record) => {
    if (!(anyone as readonly string[]).includes(input.reason) && actor.role !== "admin") {
      throw new CommandError("not-allowed", "Only an Admin can do this.");
    }
    if (input.reason === "given-away") {
      const [adjusted] = await tx.select({ kind: item.kind }).from(item).where(eq(item.id, input.itemId));
      if (adjusted?.kind !== "gift") throw new CommandError("invalid", "Only a Gift can be given away.");
    }
    const { locationId, count: have } = await lockItemStock(tx, input.itemId);
    let change: number;
    if (input.reason === "recount") {
      if (have === input.countedTo) {
        throw new CommandError("invalid", `${await locationName(tx, locationId)} already has ${have}.`);
      }
      change = input.countedTo - have;
    } else {
      change = (takes as readonly string[]).includes(input.reason) ? -input.count : input.count;
    }

    if (change > 0) await putStock(tx, input.itemId, locationId, change);
    else await takeStock(tx, input.itemId, locationId, -change);
    await tx.insert(historyEntry).values({
      itemId: input.itemId,
      kind: "adjustment",
      reason: input.reason,
      count: Math.abs(change),
      [change > 0 ? "toLocationId" : "fromLocationId"]: locationId,
      note: input.note,
      byUserId: actor.userId,
      happenedOn: input.happenedOn ?? museToday,
    });
    const [adjusted] = await tx.select({ name: item.name, kind: item.kind }).from(item).where(eq(item.id, input.itemId));
    const what = ref.item(input.itemId, adjusted.name, adjusted.kind);
    const at = ref.location(locationId, await locationName(tx, locationId));
    const n = Math.abs(change);
    await record("stock", {
      purchased: said`added ${n} purchased ${what} to ${at}`,
      found: said`added ${n} found ${what} to ${at}`,
      lost: said`marked ${n} ${what} lost from ${at}`,
      damaged: said`wrote off ${n} damaged ${what} from ${at}`,
      "given-away": said`gave away ${n} ${what} from ${at} to ${input.note ?? ""}`,
      recount: said`recounted ${what} at ${at} to ${input.reason === "recount" ? input.countedTo : 0}`,
    }[input.reason]);
  },
});
