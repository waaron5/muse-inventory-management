import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { UNASSIGNED_LOCATION } from "@/lib/stock";
import { alias } from "drizzle-orm/pg-core";
import { category, event, historyEntry, item, line, location, pastUsePhoto, shortageAcknowledgement, stock, user } from "@/db/schema";
import { z } from "zod";
import type { ReadDb } from "@/db/types";
import { todayInMuse } from "@/lib/time-zone";
import { datedColumns, holdWindow } from "../hold-window";
import { shortages } from "../shortages";
import { acknowledgementsOf, available, holdsMeeting, wentTo } from "./availability";
import { defineLoader } from "./define";
import { firstDay, inTab } from "./events";
import { historicalDetail, historicalEventName, historicalName } from "../deleted-records";

const fromLocation = alias(location, "from_location");
const toLocation = alias(location, "to_location");

// The Upcoming Events offered to reserve for; still bounded.
const MAX_EVENTS = 200;
// Past-use Photos shown, newest first; still bounded.
const MAX_PHOTOS = 200;

// Two round trips: the item, its Stock and Location, its History, its Past-use Photos and the Events it went to, the Locations
// Stock can move to, the Upcoming Events and its acknowledged Shortages side
// by side, then what's held across those Events' Hold Windows. An Inventory
// Item's page never shows a Gift, nor a Gift's page an Inventory Item.
export const loadItemScreen = defineLoader("item", (db, id: string, now?: Date) =>
  loadItem(db, id, "inventory", now),
);
export const loadGiftScreen = defineLoader("gift", (db, id: string, now?: Date) => loadItem(db, id, "gift", now));

async function loadItem(db: ReadDb, id: string, kind: "inventory" | "gift", now = new Date()) {
  if (!z.uuid().safeParse(id).success) return null;
  const today = todayInMuse(now);
  const [[found], stockRows, history, pastUses, wentToEvents, locations, upcomingEvents, acknowledgements, categories] = await Promise.all([
    db
      .select({
        id: item.id,
        name: item.name,
        sku: item.sku,
        unitPriceCents: item.unitPriceCents,
        description: item.description,
        categoryId: item.categoryId,
        categoryName: category.name,
        photo: item.photo,
        archived: sql<boolean>`${item.archivedAt} is not null`,
      })
      .from(item)
      .leftJoin(category, eq(category.id, item.categoryId))
      .where(and(eq(item.id, id), eq(item.kind, kind))),
    db
      .select({ locationId: stock.locationId, locationName: location.name, count: stock.count })
      .from(stock)
      .innerJoin(location, eq(location.id, stock.locationId))
      .where(eq(stock.itemId, id))
      .orderBy(asc(location.name)),
    db
      .select({
        id: historyEntry.id,
        kind: historyEntry.kind,
        reason: historyEntry.reason,
        count: historyEntry.count,
        from: historicalName("location", historyEntry.fromLocationId, fromLocation.name),
        to: historicalName("location", historyEntry.toLocationId, toLocation.name),
        // The Event a giveaway, Load, Return or Write-off, or its correction, was for.
        event: { id: sql<string | null>`coalesce(${event.id}::text, ${historicalDetail("line", historyEntry.lineId, "eventId")})`, name: historicalEventName(event.name, event.id, historyEntry.lineId) },
        // A giveaway made automatically is by nobody (ADR 0010).
        by: sql<string>`coalesce(${historicalName("user", historyEntry.byUserId, user.name)}, 'Automatic')`,
        note: historyEntry.note,
        happenedOn: historyEntry.happenedOn,
        recordedAt: historyEntry.recordedAt,
      })
      .from(historyEntry)
      .leftJoin(user, eq(user.id, historyEntry.byUserId))
      .leftJoin(fromLocation, eq(fromLocation.id, historyEntry.fromLocationId))
      .leftJoin(toLocation, eq(toLocation.id, historyEntry.toLocationId))
      .leftJoin(line, eq(line.id, historyEntry.lineId))
      .leftJoin(event, eq(event.id, line.eventId))
      .where(eq(historyEntry.itemId, id))
      .orderBy(desc(historyEntry.happenedOn), desc(historyEntry.recordedAt)),
    db
      .select({
        id: pastUsePhoto.id,
        photo: pastUsePhoto.photo,
        note: pastUsePhoto.note,
        event: { id: pastUsePhoto.eventId, name: historicalName("event", pastUsePhoto.eventId, event.name) },
        eventDeleted: sql<boolean>`${pastUsePhoto.eventId} is not null and ${event.id} is null`,
        by: { id: pastUsePhoto.byUserId, name: historicalName("user", pastUsePhoto.byUserId, user.name) },
        addedAt: pastUsePhoto.addedAt,
      })
      .from(pastUsePhoto)
      .leftJoin(user, eq(user.id, pastUsePhoto.byUserId))
      .leftJoin(event, eq(event.id, pastUsePhoto.eventId))
      .where(eq(pastUsePhoto.itemId, id))
      .orderBy(desc(pastUsePhoto.addedAt), desc(pastUsePhoto.id))
      .limit(MAX_PHOTOS),
    // What a Past-use Photo can name: the Events it went to, most recent first.
    db
      .select({ id: event.id, name: event.name, startsOn: event.startsOn, endsOn: event.endsOn })
      .from(line)
      .innerJoin(event, eq(event.id, line.eventId))
      .where(and(eq(line.itemId, id), wentTo(today)))
      .orderBy(sql`${firstDay} desc`, asc(event.name))
      .limit(MAX_EVENTS),
    // Where it can move to; Unassigned only ever holds what a deleted Location left.
    db
      .select({ id: location.id, name: location.name })
      .from(location)
      .where(ne(location.id, UNASSIGNED_LOCATION))
      .orderBy(asc(location.name)),
    // Events without dates first, then soonest first, as on the Events list.
    db
      .select({ id: event.id, name: event.name, ...datedColumns })
      .from(event)
      .where(inTab(today).upcoming)
      .orderBy(sql`${firstDay} asc nulls first`, asc(event.name))
      .limit(MAX_EVENTS),
    acknowledgementsOf(db, eq(shortageAcknowledgement.itemId, id)),
    kind === "inventory" ? db.select({ id: category.id, name: category.name }).from(category).orderBy(asc(sql`lower(${category.name})`)) : [],
  ]);
  if (!found) return null;

  // An Inventory Item can only be reserved for an Event with a Hold Window.
  const candidates = upcomingEvents
    .map((e) => ({ ...e, window: holdWindow(e) }))
    .filter((e) => kind === "gift" || e.window);
  const earliest = candidates.reduce((from, e) => (e.window && e.window.from < from ? e.window.from : from), today);
  const holds = await holdsMeeting(db, { from: earliest }, eq(line.itemId, id));

  const count = stockRows.reduce((sum, r) => sum + r.count, 0);
  const shortBy = new Map(
    shortages(holds, new Map([[id, count]]), today, acknowledgements)
      .filter((s) => s.flagged)
      .map((s) => [s.eventId, s.shortBy]),
  );
  return {
    item: found,
    categories,
    count,
    // Where it sits (ADR 0014).
    location: stockRows[0] ? { id: stockRows[0].locationId, name: stockRows[0].locationName } : null,
    history: history.map((entry) => ({ ...entry, event: entry.event?.id && entry.event.name ? { id: entry.event.id, name: entry.event.name } : null })),
    pastUses: pastUses.map((photo) => ({ ...photo, event: photo.event?.id && photo.event.name ? { id: photo.event.id, name: photo.event.name } : null })),
    wentTo: wentToEvents,
    locations,
    // A Gift is held until it's Given Away, the day after its Event ends.
    upcoming: holds
      .filter((h) => kind === "gift" || (h.window && h.window.to >= today))
      .sort((a, b) => byFirstDay(a.event, b.event))
      .map((h) => ({ event: h.event, reserved: h.reserved, shortBy: shortBy.get(h.event.id) ?? null })),
    reserveFor: candidates.map(({ window, ...e }) => ({
      ...e,
      available: available({ id, kind, count }, holds, { id: e.id, window }),
    })),
  };
}

// Events without dates first, then soonest first.
function byFirstDay(a: { name: string; startsOn: string | null; endsOn: string | null }, b: typeof a) {
  const first = (e: typeof a) => e.startsOn ?? e.endsOn ?? "";
  return first(a).localeCompare(first(b)) || a.name.localeCompare(b.name);
}
