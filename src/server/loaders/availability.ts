import { type AnyColumn, and, asc, desc, eq, getTableName, gt, inArray, isNull, lte, not, or, sql, type SQL, type SQLWrapper, type Table } from "drizzle-orm";
import {
  event,
  historyEntry,
  item,
  line,
  location,
  shortageAcknowledgement,
  shortageAcknowledgementEvent,
  stock,
  user,
} from "@/db/schema";
import type { ReadDb } from "@/db/types";
import { datedColumns, holdEndedBefore, holdsDuring, holdWindow, type Window } from "../hold-window";
import { historicalName } from "../deleted-records";

/** One Event's hold on one item: an Inventory Item over its Hold Window, a Gift until it's Given Away. */
export type Hold = {
  event: { id: string; name: string; startsOn: string | null; endsOn: string | null };
  itemId: string;
  kind: "inventory" | "gift";
  window: Window | null;
  reserved: number;
};

// What one History entry changes of its Line's Given Away count: a giveaway
// adds to it, and its correction puts some back.
const givenAwayChange = sql`case ${historyEntry.kind} when 'given-away' then ${historyEntry.count} when 'giveaway-correction' then -${historyEntry.count} else 0 end`;

// An outer column named in full: a select from one table leaves its columns
// bare, and a bare "id" inside the subquery would be History's own.
// (Every column knows its table; drizzle just doesn't type it.)
const outer = (column: AnyColumn) =>
  sql`${sql.identifier(getTableName((column as AnyColumn & { table: Table }).table))}.${sql.identifier(column.name)}`;

/** How many of a Gift's Line were Given Away, less leftovers put back. */
export const givenAwayOf = (lineId: AnyColumn) =>
  sql<number>`(select coalesce(sum(${givenAwayChange}), 0)::int from ${historyEntry} where ${historyEntry.lineId} = ${outer(lineId)})`;

/** Where the Stock of each item an Event reserves sits: its one Location. */
export function stockFor(db: ReadDb, eventId: string) {
  return db
    .select({ itemId: stock.itemId, locationId: stock.locationId, name: location.name, count: stock.count })
    .from(stock)
    .innerJoin(location, eq(location.id, stock.locationId))
    .where(
      and(
        inArray(stock.itemId, db.select({ itemId: line.itemId }).from(line).where(eq(line.eventId, eventId))),
        gt(stock.count, 0),
      ),
    )
    .orderBy(desc(stock.count), asc(location.name));
}

/** Whether any of an Event's Lines is in History: an entry, even one corrected away, is kept for good. */
export async function hasHistory(db: ReadDb, eventId: string) {
  const entries = await db
    .select({ id: historyEntry.id })
    .from(historyEntry)
    .innerJoin(line, eq(line.id, historyEntry.lineId))
    .where(eq(line.eventId, eventId))
    .limit(1);
  return entries.length > 0;
}

/** An item's Count: its Stock across every Location. */
export function inStorageOf(itemId: AnyColumn) {
  return sql<number>`(select coalesce(sum(${stock.count}), 0)::int from ${stock} where ${stock.itemId} = ${itemId})`;
}

/**
 * A Line whose Event still reserves its item, so the item can't be Archived:
 * an Inventory Item's until its Hold Window is over (or while it has none), a
 * Gift's until it's Given Away. Cancelled Events hold nothing.
 * Needs `line`, its `event` and its `item` in scope.
 */
export function stillReserves(today: string) {
  return and(
    isNull(event.cancelledAt),
    or(
      and(eq(item.kind, "gift"), isNull(line.givenAwayAt)),
      and(eq(item.kind, "inventory"), not(sql`coalesce(${holdEndedBefore(today)}, false)`)),
    ),
  )!;
}

/**
 * A Line whose item went to its Event: it was reserved there, and the Event
 * has begun without being Cancelled. Needs `line` and its `event` in scope.
 */
export function wentTo(today: SQLWrapper | string) {
  return and(isNull(event.cancelledAt), lte(sql`coalesce(${event.startsOn}, ${event.endsOn})`, today))!;
}

/**
 * The holds that can meet `window`: every Inventory Item Reservation whose
 * Hold Window shares a day with it, and every Gift Reservation not yet Given
 * Away, whatever its dates. Cancelled Events hold nothing.
 */
export async function holdsMeeting(db: ReadDb, window: Window | { from: string } | null, narrowedTo?: SQL) {
  const rows = await db
    .select({
      eventId: line.eventId,
      eventName: event.name,
      // Only a Reservation holds, so every hold has an item.
      itemId: item.id,
      kind: item.kind,
      reserved: line.reserved,
      ...datedColumns,
    })
    .from(line)
    .innerJoin(event, eq(event.id, line.eventId))
    .innerJoin(item, eq(item.id, line.itemId))
    .where(
      and(
        isNull(event.cancelledAt),
        or(
          and(eq(item.kind, "gift"), isNull(line.givenAwayAt)),
          and(eq(item.kind, "inventory"), window ? holdsDuring(window) : sql`false`),
        ),
        narrowedTo,
      ),
    );
  return rows.map(({ eventId, eventName, ...hold }): Hold => ({
    event: { id: eventId, name: eventName, startsOn: hold.startsOn, endsOn: hold.endsOn },
    itemId: hold.itemId,
    kind: hold.kind,
    reserved: hold.reserved,
    window: holdWindow(hold),
  }));
}

/** Each item's Count: its Stock across every Location. */
export async function countsOf(db: ReadDb, narrowedTo?: SQL) {
  const rows = await db
    .select({ itemId: item.id, count: inStorageOf(item.id) })
    .from(item)
    .where(narrowedTo);
  return new Map(rows.map((r) => [r.itemId, r.count]));
}

export type Acknowledgement = {
  eventId: string;
  itemId: string;
  /** The Event's own Shortage when it was acknowledged. */
  shortBy: number;
  /** Every Event in the clash acknowledged. */
  events: string[];
  note: string;
  by: string;
  recordedAt: Date;
};

/** The acknowledgements of each Event's Shortages, latest first. */
export async function acknowledgementsOf(db: ReadDb, narrowedTo?: SQL): Promise<Acknowledgement[]> {
  return db
    .select({
      eventId: shortageAcknowledgementEvent.eventId,
      itemId: shortageAcknowledgement.itemId,
      shortBy: shortageAcknowledgementEvent.shortBy,
      events: sql<string[]>`array(select clash.event_id from ${shortageAcknowledgementEvent} clash where clash.acknowledgement_id = ${shortageAcknowledgement.id})`,
      note: shortageAcknowledgement.note,
      by: historicalName("user", shortageAcknowledgement.byUserId, user.name),
      recordedAt: shortageAcknowledgement.recordedAt,
    })
    .from(shortageAcknowledgementEvent)
    .innerJoin(shortageAcknowledgement, eq(shortageAcknowledgement.id, shortageAcknowledgementEvent.acknowledgementId))
    .leftJoin(user, eq(user.id, shortageAcknowledgement.byUserId))
    .where(narrowedTo)
    .orderBy(desc(shortageAcknowledgement.recordedAt));
}

/**
 * How many of an item are free for one Event, or for days with no Event yet:
 * its Count minus what other Events hold. For an Inventory Item that's taken on the busiest day of the
 * Event's Hold Window (none without one); a Gift has no window. Below none is
 * a Shortage (ADR 0002).
 */
export function available(
  thing: { id: string; kind: "inventory" | "gift"; count: number },
  holds: Hold[],
  forEvent: { id?: string; window: Window | null },
) {
  const others = holds.filter((h) => h.itemId === thing.id && h.event.id !== forEvent.id);
  if (thing.kind === "gift") return thing.count - sum(others);
  if (!forEvent.window) return null;
  return thing.count - busiestDay(others, forEvent.window);
}

// The most held on any one day of the window.
function busiestDay(holds: Hold[], window: Window) {
  return Math.max(0, ...daysHeld(holds, window).map(({ held }) => held));
}

/**
 * The days of `window` worth checking, each with the holds held that day and
 * what they hold together. A sum of holds only rises on the day one starts,
 * so only the window's first day and those can be its busiest.
 */
export function daysHeld(holds: Hold[], window: Window) {
  const dated = holds.filter((h): h is Hold & { window: Window } => h.window !== null);
  const days = [window.from, ...dated.map((h) => h.window.from).filter((d) => d > window.from && d <= window.to)];
  return days.map((day) => {
    const holding = dated.filter((h) => h.window.from <= day && day <= h.window.to);
    return { day, holding, held: holding.reduce((total, h) => total + h.reserved, 0) };
  });
}

/** What a Gift's holds hold together. */
export function sum(holds: Hold[]) {
  return holds.reduce((total, h) => total + h.reserved, 0);
}
