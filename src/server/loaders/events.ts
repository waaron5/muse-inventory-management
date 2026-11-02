import { historicalName, snapshotItemKind } from "../deleted-records";
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { client, event, historyEntry, item, line } from "@/db/schema";
import { clientColour } from "@/lib/client-colour";
import { todayInMuse } from "@/lib/time-zone";
import { shortages } from "../shortages";
import { monthAsked, holdEndedBefore, type Window } from "../hold-window";
import { acknowledgementsOf, countsOf, holdsMeeting } from "./availability";
import { defineLoader } from "./define";

export type EventsTab = "upcoming" | "past" | "cancelled";
export type EventsFilters = {
  tab?: EventsTab;
  clientId?: string;
  // Events overlapping this calendar month (YYYY-MM).
  month?: string;
};

// No page controls on the list (Screens and navigation), but the query is still bounded.
const MAX_ROWS = 500;

// Two round trips: the chips' Clients beside everything held from today, to
// find the Shortages; then the tab counts and the tab's Events side
// by side. Chips narrow every tab's count. An Event is Upcoming
// through its last day in Denver, whoever is looking (ADR 0005).
export const loadEventsScreen = defineLoader(
  "events",
  async (db, filters: EventsFilters, now: Date = new Date()) => {
    const tab = filters.tab ?? "upcoming";
    const today = todayInMuse(now);
    const tabs = inTab(today);
    const [clients, holds, itemCounts, acknowledgements] = await Promise.all([
      db
        .select({ id: client.id, name: client.name })
        .from(client)
        .where(isNull(client.archivedAt))
        .orderBy(asc(client.name)),
      holdsMeeting(db, { from: today }),
      countsOf(db),
      acknowledgementsOf(db),
    ]);

    // An Event's badge is its worst Shortage not yet acknowledged.
    const shortBy = new Map<string, number>();
    for (const s of shortages(holds, itemCounts, today, acknowledgements)) {
      if (s.flagged) shortBy.set(s.eventId, Math.max(shortBy.get(s.eventId) ?? 0, s.shortBy));
    }

    const dates = monthAsked(filters.month);
    const matching = narrowedBy(filters, dates);
    const [[counts], rows] = await Promise.all([
      db
        .select({
          upcoming: sql<number>`count(*) filter (where ${tabs.upcoming})::int`,
          past: sql<number>`count(*) filter (where ${tabs.past})::int`,
          cancelled: sql<number>`count(*) filter (where ${tabs.cancelled})::int`,
        })
        .from(event)
        .leftJoin(client, eq(client.id, event.clientId))
        .where(matching),
      db
        .select({
          id: event.id,
          name: event.name,
          plCode: event.plCode,
          clientName: historicalName("client", event.clientId, client.name),
          clientColour: client.colour,
          venue: event.venue,
          startsOn: event.startsOn,
          endsOn: event.endsOn,
          ended: sql<boolean>`coalesce(${holdEndedBefore(today)}, false)`,
          // Gifts are never Inventory: each Line falls into one or the other.
          inventoryLines: sql<number>`(select count(*)::int from ${line} left join ${item} on ${item.id} = ${line.itemId} where ${line.eventId} = ${event.id} and (${line.kind} = 'borrowed' or ${snapshotItemKind(line.itemId, item.kind)} = 'inventory'))`,
          giftLines: sql<number>`(select count(*)::int from ${line} left join ${item} on ${item.id} = ${line.itemId} where ${line.eventId} = ${event.id} and ${snapshotItemKind(line.itemId, item.kind)} = 'gift')`,
          cancelled: sql<boolean>`${event.cancelledAt} is not null`,
          inHistory: sql<boolean>`exists (select 1 from ${historyEntry} inner join ${line} on ${line.id} = ${historyEntry.lineId} where ${line.eventId} = ${event.id})`,
        })
        .from(event)
        .leftJoin(client, eq(client.id, event.clientId))
        .where(and(matching, tabs[tab]))
        // Grouped by month on screen, so the order follows each Event's first
        // day: Upcoming soonest first and Past and Cancelled most recent first,
        // with Events without dates at the bottom.
        .orderBy(
          ...(tab === "upcoming"
            ? [sql`${firstDay} asc nulls last`, asc(lastDay)]
            : [sql`${firstDay} desc nulls last`, desc(lastDay)]),
          asc(event.name),
        )
        .limit(MAX_ROWS),
    ]);
    const events = rows.map(({ clientName, clientColour: colour, inventoryLines, giftLines, ...row }) => ({
      ...row,
      lines: { inventory: inventoryLines, gifts: giftLines },
      client: { name: clientName, colour: colour ?? clientColour(clientName) },
      shortBy: shortBy.get(row.id) ?? null,
    }));
    return { clients, dates, counts, events };
  },
);

// An Event without an end date lasts its start day, and one without a start
// date begins on its end day.
const lastDay = sql`coalesce(${event.endsOn}, ${event.startsOn})`;
export const firstDay = sql`coalesce(${event.startsOn}, ${event.endsOn})`;

export function inTab(today: string): Record<EventsTab, SQL> {
  return {
    upcoming: and(isNull(event.cancelledAt), or(sql`${lastDay} is null`, sql`${lastDay} >= ${today}`))!,
    past: and(isNull(event.cancelledAt), lt(lastDay, today))!,
    cancelled: isNotNull(event.cancelledAt),
  };
}

// A filter from a stale or hand-edited URL is dropped, not an error.
function narrowedBy(filters: EventsFilters, dates: Window | null) {
  const clientId = z.uuid().safeParse(filters.clientId).data;
  return and(
    clientId ? eq(event.clientId, clientId) : undefined,
    // An Event without dates overlaps none.
    dates ? and(lte(firstDay, dates.to), gte(lastDay, dates.from)) : undefined,
  );
}

