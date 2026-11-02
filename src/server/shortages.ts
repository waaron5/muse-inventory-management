import { type Acknowledgement, daysHeld, type Hold, sum } from "./loaders/availability";

/**
 * One Event's Shortage of one item: "short by N" on the worst day it holds the
 * item, and the other Events holding it on the days it's short. It's flagged
 * until an Admin acknowledges it, and again once it grows past that or an
 * Event outside the clash acknowledged joins it.
 */
export type Shortage = {
  eventId: string;
  itemId: string;
  shortBy: number;
  competing: Hold[];
  /** The acknowledgement covering it, or else the latest one, from before it changed. */
  acknowledged: Acknowledgement | null;
  flagged: boolean;
};

/**
 * Every Shortage among `holds`, against each item's Count. An Inventory Item
 * is short on a day when Events hold more than its Count, taken from `today`
 * on, since days gone hold nothing. A Gift has no window: it is short while its holds add up to more than its
 * Count (ADR 0002).
 */
export function shortages(
  holds: Hold[],
  counts: Map<string, number>,
  today: string,
  acknowledgements: Acknowledgement[] = [],
): Shortage[] {
  const acked = Map.groupBy(acknowledgements, (a) => `${a.eventId} ${a.itemId}`);
  const byItem = Map.groupBy(holds, (h) => h.itemId);
  return [...byItem].flatMap(([itemId, held]) => {
    const count = counts.get(itemId) ?? 0;
    return held.flatMap((hold) => {
      const found = held[0].kind === "gift" ? giftShortage(hold, held, count) : inventoryShortage(hold, held, count, today);
      if (!found) return [];
      // Latest first: the newest acknowledgement still covering it wins.
      const all = acked.get(`${hold.event.id} ${itemId}`) ?? [];
      const covering = all.find(
        (a) => found.shortBy <= a.shortBy && found.competing.every((h) => a.events.includes(h.event.id)),
      );
      return [{ eventId: hold.event.id, itemId, ...found, acknowledged: covering ?? all[0] ?? null, flagged: !covering }];
    });
  });
}

function giftShortage(hold: Hold, held: Hold[], count: number) {
  const shortBy = sum(held) - count;
  return shortBy > 0 ? { shortBy, competing: held.filter((h) => h !== hold) } : null;
}

function inventoryShortage(hold: Hold, held: Hold[], count: number, today: string) {
  if (!hold.window) return null;
  const from = hold.window.from > today ? hold.window.from : today;
  const to = hold.window.to;
  if (from > to) return null;

  let shortBy = 0;
  const competing = new Set<Hold>();
  for (const { holding, held: total } of daysHeld(held, { from, to })) {
    const over = total - count;
    if (over <= 0) continue;
    shortBy = Math.max(shortBy, over);
    for (const h of holding) if (h !== hold) competing.add(h);
  }
  return shortBy > 0 ? { shortBy, competing: [...competing] } : null;
}
