import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { event, historyEntry, item, line, location, stock } from "@/db/schema";
import type { Tx } from "@/db/types";
import { todayInMuse } from "@/lib/time-zone";
import { CommandError } from "../errors";
import { datedColumns, holdWindow } from "../hold-window";
import { givenAwayOf } from "../loaders/availability";
import { ref, said } from "./activity";
import { defineCommand, type SignedIn } from "./define";
import { lockItemStock, putStock, takeStock } from "./stock";
import { remember } from "../deleted-records";
import { lineName } from "../loaders/lines";

// Anyone can change or remove a Line: a Reservation or a Borrowed Item. A count
// above what's Available still saves (ADR 0002). Once a Gift Line is Given Away its count is how many went, which may be fewer than
// were reserved, or none: changing it gives away the difference or puts
// leftovers back, and leaves what was reserved as it was (ADR 0010).

/**
 * The Line, refusing one that's gone, or one on a Cancelled Event: those wait
 * as they were, to come back when it's reinstated.
 */
async function changeable(tx: Tx, lineId: string) {
  const [found] = await tx
    .select({ eventId: event.id, eventName: event.name, cancelledAt: event.cancelledAt, ...datedColumns })
    .from(line)
    .innerJoin(event, eq(event.id, line.eventId))
    .where(eq(line.id, lineId))
    // Held while this saves, as reserve holds it, so the Event can't be cancelled
    // nor given away under it.
    .for("share", { of: event });
  if (!found) throw new CommandError("invalid", "That Line was removed.");
  if (found.cancelledAt) throw new CommandError("invalid", "Reinstate the Event before changing what it has reserved.");
  return { ...found, event: ref.event(found.eventId, found.eventName) };
}

/** A Line as Activity names it: its item, or the name typed for it. */
function named(l: { itemId: string | null; name: string; kind: "inventory" | "gift" | null }) {
  return l.itemId && l.kind ? ref.item(l.itemId, l.name, l.kind) : l.name;
}

export const changeReserved = defineCommand({
  name: "changeReserved",
  input: z.object({
    lineId: z.uuid("That Line was removed."),
    // None only for a Gift once it's Given Away: all of it came back.
    count: z.int("Enter a whole number.").min(0, "Reserve at least 1, or remove the Line."),
  }),
  allow: ["admin", "user"],
  run: async (tx, actor, { lineId, count }, record) => {
    const found = await changeable(tx, lineId);
    // Locked, so two changes at once are served in turn and the second sees what the first gave away.
    const [given] = await tx
      .select({ itemId: line.itemId, name: item.name, kind: item.kind, lineName, reserved: line.reserved, givenAwayAt: line.givenAwayAt })
      .from(line)
      .leftJoin(item, eq(item.id, line.itemId))
      .where(eq(line.id, lineId))
      .for("update", { of: line });
    if (given.itemId && !given.name) throw new CommandError("invalid", "This item was deleted. Its past count stays on record.");
    if (!given.givenAwayAt || !given.itemId) {
      if (count < 1) throw new CommandError("invalid", "Reserve at least 1, or remove the Line.");
      await tx.update(line).set({ reserved: count }).where(eq(line.id, lineId));
      const what = named({ itemId: given.itemId, name: given.lineName, kind: given.kind });
      await record("events", count === given.reserved ? null : said`changed ${what} on ${found.event} to ${count}`);
      return;
    }
    const [{ went }] = await tx.select({ went: givenAwayOf(line.id) }).from(line).where(eq(line.id, lineId));
    const change = { tx, actor, lineId, itemId: given.itemId, name: given.name! };
    // On the Event's last day, as the giveaway was; never a day still to come,
    // should its dates have moved since.
    const today = todayInMuse();
    const lastDay = holdWindow(found)?.to;
    const happenedOn = lastDay && lastDay < today ? lastDay : today;
    if (count > went) await giveAwayMore({ ...change, count: count - went, happenedOn });
    if (count < went) await putLeftoversBack({ ...change, count: went - count });
    const what = named({ itemId: given.itemId, name: given.name!, kind: given.kind });
    await record("events", count === went ? null : said`changed ${what} given away at ${found.event} to ${count}`);
  },
});

type Change = { tx: Tx; actor: SignedIn; lineId: string; itemId: string; name: string; count: number };

// More went than was counted: from its Location.
async function giveAwayMore({ tx, actor, lineId, itemId, name, count, happenedOn }: Change & { happenedOn: string }) {
  const held = await tx
    .select({ locationId: stock.locationId, count: stock.count })
    .from(stock)
    .innerJoin(location, eq(location.id, stock.locationId))
    .where(and(eq(stock.itemId, itemId), gt(stock.count, 0)))
    .orderBy(desc(stock.count), asc(location.name))
    .for("update", { of: stock });
  const inStorage = held.reduce((total, h) => total + h.count, 0);
  if (inStorage < count) {
    throw new CommandError(
      "invalid",
      inStorage === 0 ? `There are no ${name} in storage to give away.` : `There are only ${inStorage} ${name} in storage.`,
    );
  }
  let left = count;
  for (const h of held) {
    const taken = Math.min(left, h.count);
    if (taken === 0) break;
    left -= taken;
    await takeStock(tx, itemId, h.locationId, taken);
    await tx.insert(historyEntry).values({
      itemId,
      kind: "given-away",
      count: taken,
      fromLocationId: h.locationId,
      lineId,
      byUserId: actor.userId,
      happenedOn,
    });
  }
}

// Leftovers go back into the item's Stock at its Location, wherever they were
// given away from (ADR 0014), taken off the giveaway that took the most first,
// each keeping its giveaway's day.
async function putLeftoversBack({ tx, actor, lineId, itemId, name, count }: Change) {
  const left = sql<number>`(${historyEntry.count} - coalesce((select sum(c.count) from ${historyEntry} c where c.corrects_id = ${historyEntry.id}), 0))::int`;
  const giveaways = await tx
    .select({ id: historyEntry.id, left, happenedOn: historyEntry.happenedOn })
    .from(historyEntry)
    .where(and(eq(historyEntry.lineId, lineId), eq(historyEntry.kind, "given-away")))
    .orderBy(desc(left), asc(historyEntry.recordedAt));
  const returnable = giveaways.reduce((total, g) => total + Math.max(g.left, 0), 0);
  if (returnable < count) {
    throw new CommandError("invalid", `Only ${returnable} ${name} can go back into Stock.`);
  }
  const { locationId } = await lockItemStock(tx, itemId);
  let rest = count;
  for (const g of giveaways) {
    const back = Math.min(rest, g.left);
    if (back <= 0) continue;
    rest -= back;
    await putStock(tx, itemId, locationId, back);
    await tx.insert(historyEntry).values({
      itemId,
      kind: "giveaway-correction",
      count: back,
      toLocationId: locationId,
      lineId,
      correctsId: g.id,
      byUserId: actor.userId,
      happenedOn: g.happenedOn,
    });
  }
}

export const removeLine = defineCommand({
  name: "removeLine",
  input: z.object({ lineId: z.uuid("That Line was removed.") }),
  allow: ["admin", "user"],
  run: async (tx, actor, { lineId }, record) => {
    const { event: from } = await changeable(tx, lineId);
    if (actor.role !== "admin" && await tx.$count(historyEntry, eq(historyEntry.lineId, lineId)) > 0) {
      throw new CommandError("not-allowed", "Only an Admin can delete a Line in History.");
    }
    const [found] = await tx
      .select({ name: lineName, eventId: line.eventId, itemId: line.itemId, kind: item.kind })
      .from(line)
      .leftJoin(item, eq(item.id, line.itemId))
      .where(eq(line.id, lineId)).for("update", { of: line });
    if (!found) throw new CommandError("invalid", "That Line was removed.");
    await remember(tx, { id: lineId, kind: "line", name: found.name, details: { eventId: found.eventId } });
    await tx.delete(line).where(eq(line.id, lineId));
    await record("events", said`removed ${named(found)} from ${from}`);
  },
});
