import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { category, event, item, location, shortageAcknowledgementEvent, stock } from "@/db/schema";
import type { ReadDb } from "@/db/types";
import { todayInMuse } from "@/lib/time-zone";
import { daysAsked, holdWindow } from "../hold-window";
import { shortages } from "../shortages";
import { acknowledgementsOf, available, type Hold, holdsMeeting, inStorageOf, sum } from "./availability";
import { defineLoader } from "./define";

/** The most items one availability question covers, as on the Inventory list. */
export const AI_AVAILABILITY_MAX = 500;

/** Which items: some by id, or a Category's Inventory Items, Archived ones only when asked for. */
export type AiAvailabilityItems = { itemIds: string[] } | { categoryId: string; archived?: boolean };
/** Over which days: given calendar days (one alone is that day), or an Event's Hold Window. */
export type AiAvailabilityOver = { from: string; to?: string } | { eventId: string };

/**
 * An AI Connection's availability question (ADR 0017): how many of some items
 * are Available over given days, as the Inventory list's date filter counts
 * them, or over an Event's Hold Window, as the Event's page offers them to
 * reserve, with any Shortage. Null when the Event or the days aren't there.
 * Over given days it's one round trip; over an Event, two.
 */
export const loadAiAvailability = defineLoader(
  "aiAvailability",
  async (db, question: AiAvailabilityItems & AiAvailabilityOver, now: Date = new Date()) => {
    const today = todayInMuse(now);
    if ("eventId" in question) return overEvent(db, question, question.eventId, today);
    const days = daysAsked(question.from, question.to);
    if (!days) return null;
    const [things, holds] = await Promise.all([itemsAsked(db, question), holdsMeeting(db, days)]);
    // A Shortage is taken from today on, since days gone hold nothing.
    const ahead = days.to < today ? null : { from: days.from > today ? days.from : today, to: days.to };
    return {
      over: days,
      items: things.map((thing) => {
        // A Gift has no window: it's short while its holds add up to more than its Count.
        const short = thing.kind === "gift" || ahead ? available(thing, holds, { window: ahead ?? days }) : null;
        return {
          ...thing,
          available: available(thing, holds, { window: days }),
          shortBy: short !== null && short < 0 ? -short : null,
          heldBy: heldBy(holds, thing.id),
        };
      }),
    };
  },
);

async function overEvent(db: ReadDb, question: AiAvailabilityItems, eventId: string, today: string) {
  const [[found], things, acknowledgements] = await Promise.all([
    db
      .select({ id: event.id, name: event.name, startsOn: event.startsOn, endsOn: event.endsOn, cancelled: sql<boolean>`${event.cancelledAt} is not null` })
      .from(event)
      .where(eq(event.id, eventId)),
    itemsAsked(db, question),
    acknowledgementsOf(db, eq(shortageAcknowledgementEvent.eventId, eventId)),
  ]);
  if (!found) return null;
  const window = holdWindow(found);
  // As the Event's page: what other Events hold across its Hold Window.
  const holds = await holdsMeeting(db, window);
  const counts = new Map(things.map((t) => [t.id, t.count]));
  const eventShortages = new Map(
    shortages(holds, counts, today, acknowledgements)
      .filter((s) => s.eventId === eventId)
      .map((s) => [s.itemId, s]),
  );
  return {
    over: { event: found, ...(window ?? { from: null, to: null }) },
    items: things.map((thing) => {
      const shortage = eventShortages.get(thing.id);
      return {
        ...thing,
        // An Inventory Item has none until the Event has dates.
        available: available(thing, holds, { id: eventId, window }),
        reservedForEvent: sum(holds.filter((h) => h.itemId === thing.id && h.event.id === eventId)),
        shortage: shortage
          ? { shortBy: shortage.shortBy, flagged: shortage.flagged, competing: shortage.competing.map((h) => ({ event: h.event, reserved: h.reserved })) }
          : null,
        heldBy: heldBy(holds, thing.id, eventId),
      };
    }),
  };
}

function itemsAsked(db: ReadDb, question: AiAvailabilityItems) {
  return db
    .select({
      id: item.id,
      name: item.name,
      sku: item.sku,
      kind: item.kind,
      category: category.name,
      location: location.name,
      count: inStorageOf(item.id),
      archived: sql<boolean>`${item.archivedAt} is not null`,
    })
    .from(item)
    .leftJoin(category, eq(category.id, item.categoryId))
    // The item's one Location (ADR 0014).
    .leftJoin(stock, eq(stock.itemId, item.id))
    .leftJoin(location, eq(location.id, stock.locationId))
    .where(
      "itemIds" in question
        ? inArray(item.id, question.itemIds)
        : and(eq(item.categoryId, question.categoryId), eq(item.kind, "inventory"), question.archived ? undefined : isNull(item.archivedAt)),
    )
    .orderBy(asc(item.name))
    .limit(AI_AVAILABILITY_MAX);
}

// The other Events holding it over those days, soonest first.
function heldBy(holds: Hold[], itemId: string, eventId?: string) {
  return holds
    .filter((h) => h.itemId === itemId && h.event.id !== eventId)
    .sort((a, b) => (a.window?.from ?? "").localeCompare(b.window?.from ?? "") || a.event.name.localeCompare(b.event.name))
    .map((h) => ({ event: h.event, reserved: h.reserved }));
}

