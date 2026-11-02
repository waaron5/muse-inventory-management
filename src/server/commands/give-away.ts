import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { activity, event, historyEntry, item, line, location, stock } from "@/db/schema";
import type { Db } from "@/db/types";
import { datedColumns, holdEndedBefore, holdWindow } from "../hold-window";
import { timed } from "../timing";
import { museToday } from "../today";
import { ref, said } from "./activity";
import { takeStock } from "./stock";

/**
 * The day after an Event ends, its reserved Gifts are Given Away by nobody
 * (ADR 0010): each Gift Line's count from its Location (ADR 0014),
 * never more than is in Stock, on the Event's last day. A Line is given away
 * once, so a run that's missed is caught up by the next. Events without dates
 * never end, and a Cancelled Event gives nothing away.
 *
 * Run daily by Vercel Cron, with no actor, so it's the one command that isn't
 * a `defineCommand`; it still writes its History in one transaction, and its
 * Activity by nobody: one entry for each Line that gave any away.
 */
export function giveAwayEnded(db: Db) {
  return timed("command", "giveAwayEnded", () =>
    db.transaction(async (tx) => {
      // Locked until this saves, Events and all, so a run beside this one waits
      // and finds them given away, and nothing changes the Lines meanwhile.
      const lines = await tx
        .select({
          id: line.id,
          itemId: item.id,
          itemName: item.name,
          eventId: event.id,
          eventName: event.name,
          reserved: line.reserved,
          ...datedColumns,
        })
        .from(line)
        .innerJoin(event, eq(event.id, line.eventId))
        .innerJoin(item, eq(item.id, line.itemId))
        .where(
          and(eq(item.kind, "gift"), isNull(line.givenAwayAt), isNull(event.cancelledAt), holdEndedBefore(museToday)),
        )
        .orderBy(sql`coalesce(${event.endsOn}, ${event.startsOn})`, asc(line.createdAt), asc(line.id))
        .for("update", { of: [line, event] });
      if (lines.length === 0) return { lines: 0 };

      const held = await tx
        .select({ itemId: stock.itemId, locationId: stock.locationId, count: stock.count })
        .from(stock)
        .innerJoin(location, eq(location.id, stock.locationId))
        .where(and(inArray(stock.itemId, [...new Set(lines.map((l) => l.itemId))]), gt(stock.count, 0)))
        .orderBy(desc(stock.count), asc(location.name))
        .for("update", { of: stock });

      // The Event that ended first takes first.
      const gifts = lines.flatMap((l) => {
        let left = l.reserved;
        return held
          .filter((h) => h.itemId === l.itemId)
          .map((h) => {
            const count = Math.min(left, h.count);
            left -= count;
            h.count -= count;
            return { lineId: l.id, itemId: l.itemId, locationId: h.locationId, count, happenedOn: holdWindow(l)!.to };
          })
          .filter((g) => g.count > 0);
      });
      for (const g of gifts) await takeStock(tx, g.itemId, g.locationId, g.count);
      if (gifts.length > 0) {
        await tx.insert(historyEntry).values(
          gifts.map((g) => ({
            itemId: g.itemId,
            kind: "given-away" as const,
            count: g.count,
            fromLocationId: g.locationId,
            lineId: g.lineId,
            byUserId: null,
            happenedOn: g.happenedOn,
          })),
        );
        const went = lines
          .map((l) => ({ l, count: gifts.filter((g) => g.lineId === l.id).reduce((total, g) => total + g.count, 0) }))
          .filter(({ count }) => count > 0);
        await tx.insert(activity).values(
          went.map(({ l, count }) => ({
            byUserId: null,
            area: "stock" as const,
            sentence: said`gave away ${count} ${ref.item(l.itemId, l.itemName, "gift")} for ${ref.event(l.eventId, l.eventName)}`,
          })),
        );
      }
      await tx
        .update(line)
        .set({ givenAwayAt: sql`now()` })
        .where(inArray(line.id, lines.map((l) => l.id)));
      return { lines: lines.length };
    }),
  );
}
