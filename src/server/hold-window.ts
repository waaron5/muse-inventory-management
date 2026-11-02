import { sql, type SQLWrapper } from "drizzle-orm";
import { z } from "zod";
import { event } from "@/db/schema";

/** Calendar days in Muse's time zone, both ends counting (ADR 0005). */
export type Window = { from: string; to: string };

/**
 * The days a filter asks about, in order; one day alone is that day. Dates
 * from a stale or hand-edited URL are dropped, not an error.
 */
export function daysAsked(from?: string, to?: string): Window | null {
  const day = (value?: string) => z.iso.date().safeParse(value).data;
  const first = day(from) ?? day(to);
  const last = day(to) ?? first;
  if (!first || !last) return null;
  return first <= last ? { from: first, to: last } : { from: last, to: first };
}

/** All calendar days in a chosen month; malformed URL values are ignored. */
export function monthAsked(month?: string): Window | null {
  if (!month || !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const from = `${month}-01`;
  const last = new Date(`${from}T00:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return { from, to: `${month}-${String(last.getUTCDate()).padStart(2, "0")}` };
}

type Dated = { startsOn: string | null; endsOn: string | null };

/** The Event columns a Hold Window is worked out from. */
export const datedColumns = {
  startsOn: event.startsOn,
  endsOn: event.endsOn,
};

/**
 * The days an Event's Inventory Item Reservations hold stock: its own dates,
 * both ends counting (ADR 0010). An Event with only one date set lasts that
 * day; one with none has no Hold Window, and never ends.
 */
export function holdWindow(e: Dated): Window | null {
  const from = e.startsOn ?? e.endsOn;
  const to = e.endsOn ?? e.startsOn;
  if (from === null || to === null) return null;
  return { from, to };
}

// The same Hold Window in SQL, for finding the Events whose windows meet.
const holdFrom = sql`coalesce(${event.startsOn}, ${event.endsOn})`;
const holdTo = sql`coalesce(${event.endsOn}, ${event.startsOn})`;

/** Events whose Hold Window shares at least one day with `window`; without an end, any day from its start. */
export function holdsDuring(window: Window | { from: string }) {
  const to = "to" in window ? sql` and ${holdFrom} <= ${window.to}` : sql``;
  return sql`(${holdTo} >= ${window.from}${to})`;
}

/** Events whose Hold Window ended before `today`: null, never true, for one without dates. */
export function holdEndedBefore(today: SQLWrapper | string) {
  return sql`(${holdTo} < ${today})`;
}
