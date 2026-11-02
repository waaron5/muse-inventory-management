import { historicalName, snapshotItemKind } from "../deleted-records";
import { asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { client, event, item, line, shortageAcknowledgementEvent, stock, user } from "@/db/schema";
import { clientColour } from "@/lib/client-colour";
import { todayInMuse } from "@/lib/time-zone";
import { holdWindow } from "../hold-window";
import { shortages } from "../shortages";
import { acknowledgementsOf, available, countsOf, givenAwayOf, hasHistory, holdsMeeting } from "./availability";
import { defineLoader } from "./define";
import { inSection, lineName, linesInOrder } from "./lines";

// The picker reads the whole catalog; it's still bounded.
const MAX_RESERVABLE = 1000;

// Two round trips: the Event, its Lines, the catalog, the Lines' Counts and
// acknowledged Shortages, and whether it's in History, side by side, then
// what other Events hold across its Hold Window.
export const loadEventScreen = defineLoader("event", async (db, id: string, now: Date = new Date()) => {
  if (!z.uuid().safeParse(id).success) return null;
  const inStorage = sql<number>`coalesce(sum(${stock.count}), 0)::int`;
  const [[found], rawLines, catalog, counts, acknowledgements, inHistory] = await Promise.all([
    db
      .select({
        id: event.id,
        name: event.name,
        client: { id: event.clientId, name: historicalName("client", event.clientId, client.name) },
        clientColour: client.colour,
        plCode: event.plCode,
        venue: event.venue,
        notes: event.notes,
        startsOn: event.startsOn,
        endsOn: event.endsOn,
        cancelledAt: event.cancelledAt,
      })
      .from(event)
      .leftJoin(client, eq(client.id, event.clientId))
      .where(eq(event.id, id)),
    db
      .select({
        id: line.id,
        kind: line.kind,
        // A Reservation's item; a Borrowed Item has none, only its own name.
        item: { id: item.id, kind: item.kind, name: item.name, unitPriceCents: item.unitPriceCents, photo: item.photo },
        name: lineName,
        savedItemId: line.itemId,
        savedKind: snapshotItemKind(line.itemId, item.kind),
        lender: line.lender,
        reserved: line.reserved,
        // A Gift Line is Given Away once its Event ends, ending its hold:
        // how many went, which may be fewer than were reserved.
        givenAway: sql<number | null>`case when ${line.givenAwayAt} is null then null else ${givenAwayOf(line.id)} end`,
        // Who added it, by the name they go by, or had when deleted (ADR 0011).
        addedBy: sql<string | null>`case when ${line.addedByUserId} is null then null else coalesce(nullif(${user.name}, ''), ${user.email}, (select snapshot.name from deleted_record snapshot where snapshot.kind = 'user' and snapshot.id = ${line.addedByUserId})) end`,
        addedByColour: sql<number | null>`coalesce(${user.avatarColourChoice}, ${user.avatarColour})`,
        createdAt: line.createdAt,
      })
      .from(line)
      .leftJoin(item, eq(item.id, line.itemId))
      .leftJoin(user, eq(user.id, line.addedByUserId))
      .where(eq(line.eventId, id))
      .orderBy(...linesInOrder),
    db
      .select({ id: item.id, kind: item.kind, name: item.name, sku: item.sku, photo: item.photo, count: inStorage })
      .from(item)
      .leftJoin(stock, eq(stock.itemId, item.id))
      .where(isNull(item.archivedAt))
      .groupBy(item.id)
      .orderBy(asc(item.name))
      .limit(MAX_RESERVABLE),
    countsOf(db, inArray(item.id, db.select({ id: line.itemId }).from(line).where(eq(line.eventId, id)))),
    acknowledgementsOf(db, eq(shortageAcknowledgementEvent.eventId, id)),
    hasHistory(db, id),
  ]);
  if (!found) return null;
  const lines = rawLines.map(({ savedItemId, savedKind, addedBy, addedByColour, createdAt, ...l }) => ({
    ...l,
    // The day is Muse's, so it reads the same wherever someone is (ADR 0005).
    addedBy: addedBy ? { name: addedBy, colour: addedByColour ?? undefined, on: todayInMuse(createdAt) } : null,
    deleted: l.kind === "reservation" && !l.item,
    item: l.item ?? (savedItemId && savedKind ? { id: savedItemId, kind: savedKind, name: l.name, unitPriceCents: null, photo: null } : null),
  }));
  const today = todayInMuse(now);
  const window = holdWindow(found);
  const holds = await holdsMeeting(db, window);

  const reservable = catalog.map((thing) => ({
    ...thing,
    available: available(thing, holds, { id, window }),
  }));
  const names = new Map(lines.flatMap((l) => (l.item ? [[l.item.id, l.item.name]] : [])));
  const eventShortages = shortages(holds, counts, today, acknowledgements)
    .filter((s) => s.eventId === id)
    .map(({ itemId, shortBy, competing, acknowledged, flagged }) => ({
      item: { id: itemId, name: names.get(itemId)! },
      shortBy,
      competing: competing.map((h) => ({ event: h.event, reserved: h.reserved })),
      acknowledged: acknowledged && {
        shortBy: acknowledged.shortBy,
        note: acknowledged.note,
        by: acknowledged.by,
        recordedAt: acknowledged.recordedAt,
      },
      flagged,
    }))
    .sort((a, b) => a.item.name.localeCompare(b.item.name));

  const { cancelledAt, clientColour: colour, ...rest } = found;
  return {
    ...rest,
    client: { ...rest.client, colour: colour ?? clientColour(rest.client.name) },
    holdWindow: window,
    cancelled: cancelledAt !== null,
    // It can be cancelled only before it ends, and deleted only if it's in no History.
    ended: window !== null && window.to < today,
    inHistory,
    // Gifts are never Inventory: the Event's Lines fall into one or the other.
    inventory: lines.filter((l) => inSection(l) === "inventory"),
    gifts: lines.filter((l) => inSection(l) === "gift"),
    // Flagged until acknowledged; an acknowledged one stays, to say who covered it and how.
    shortages: eventShortages,
    // Borrowed Items are unpriced, as is an item without a Unit Price.
    reservedCents: lines.reduce((total, l) => total + l.reserved * (l.item?.unitPriceCents ?? 0), 0),
    // An Inventory Item can't be reserved until the Event has a Hold Window.
    reservable: {
      inventory: window ? reservable.filter((r) => r.kind === "inventory") : [],
      gifts: reservable.filter((r) => r.kind === "gift"),
    },
  };
});

/** An Event as its page shows it. */
export type EventScreen = NonNullable<Awaited<ReturnType<typeof loadEventScreen>>>;

/** What an Event's Inventory and Gifts need: on its page, or in its row's panel on the Events list. */
export type EventLinesData = Pick<
  EventScreen,
  "id" | "cancelled" | "holdWindow" | "inventory" | "gifts" | "shortages" | "reservable"
>;
