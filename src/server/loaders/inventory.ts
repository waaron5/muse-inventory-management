import { and, asc, eq, exists, isNotNull, isNull, sql } from "drizzle-orm";
import { category, event, item, line, location, stock } from "@/db/schema";
import { z } from "zod";
import type { ReadDb } from "@/db/types";
import { todayInMuse } from "@/lib/time-zone";
import { daysAsked } from "../hold-window";
import { shortages } from "../shortages";
import { acknowledgementsOf, available, type Hold, holdsMeeting, stillReserves, sum } from "./availability";
import { defineLoader } from "./define";

export type InventoryFilters = {
  categoryId?: string;
  locationId?: string;
  archived?: boolean;
  // Inventory only: list what's Available across these days.
  availableFrom?: string;
  availableTo?: string;
};

// No page controls on the list (Screens and navigation), but the query is still bounded.
const MAX_ROWS = 500;

// One round trip: the Location filter's options, the matching items, what's
// held across the asked-for dates and what's held from today, side by side.
export const loadInventoryScreen = defineLoader("inventory", (db, filters: InventoryFilters) =>
  loadCatalog(db, "inventory", filters),
);

/**
 * The Inventory or Gifts list. Gifts with none left stay listed, after the rest,
 * until they're Archived.
 */
export async function loadCatalog(db: ReadDb, kind: "inventory" | "gift", filters: InventoryFilters) {
  const inStorage = sql<number>`coalesce(sum(${stock.count}), 0)::int`;
  // A filter from a stale or hand-edited URL is dropped, not an error.
  const locationId = z.uuid().safeParse(filters.locationId).data;
  const categoryId = kind === "inventory" ? z.uuid().safeParse(filters.categoryId).data : undefined;
  const unassigned = kind === "inventory" && filters.categoryId === "unassigned";
  const window = kind === "inventory" ? daysAsked(filters.availableFrom, filters.availableTo) : null;
  const today = todayInMuse();
  const [locations, rows, holds, categories, upcoming, acknowledgements] = await Promise.all([
    db
      .select({ id: location.id, name: location.name })
      .from(location)
      .orderBy(asc(location.name)),
    db
      .select({
        id: item.id,
        name: item.name,
        sku: item.sku,
        description: item.description,
        unitPriceCents: item.unitPriceCents,
        photo: item.photo,
        archived: sql<boolean>`${item.archivedAt} is not null`,
        count: inStorage,
        location: whereItSits,
        reserved: sql<boolean>`exists (select 1 from ${line} inner join ${event} on ${event.id} = ${line.eventId} where ${line.itemId} = ${item.id} and ${stillReserves(today)})`,
      })
      .from(item)
      .leftJoin(stock, eq(stock.itemId, item.id))
      .where(
        and(
          eq(item.kind, kind),
          unassigned ? isNull(item.categoryId) : categoryId ? eq(item.categoryId, categoryId) : undefined,
          filters.archived ? isNotNull(item.archivedAt) : isNull(item.archivedAt),
          locationId
            ? exists(
                db
                  .select({ one: sql`1` })
                  .from(stock)
                  .where(and(eq(stock.itemId, item.id), eq(stock.locationId, locationId))),
              )
            : undefined,
        ),
      )
      .groupBy(item.id)
      .orderBy(...(kind === "gift" ? [asc(sql`${inStorage} = 0`)] : []), asc(item.name))
      .limit(MAX_ROWS),
    window ? holdsMeeting(db, window) : [],
    kind === "inventory" ? db.select({ id: category.id, name: category.name }).from(category).orderBy(asc(sql`lower(${category.name})`)) : [],
    holdsMeeting(db, { from: today }, eq(item.kind, kind)),
    acknowledgementsOf(db),
  ]);

  // An item's badge is its worst Shortage not yet acknowledged, as on its Events' rows.
  const counts = new Map(rows.map((row) => [row.id, row.count]));
  const shortBy = new Map<string, number>();
  for (const s of shortages(upcoming, counts, today, acknowledgements)) {
    if (s.flagged) shortBy.set(s.itemId, Math.max(shortBy.get(s.itemId) ?? 0, s.shortBy));
  }
  const heldFromToday = Map.groupBy(upcoming, (h) => h.itemId);

  const items = rows.map((row) => {
    const held = heldFromToday.get(row.id) ?? [];
    return {
      ...row,
      available: window ? available({ ...row, kind }, holds, { window }) : null,
      shortBy: shortBy.get(row.id) ?? null,
      // A Gift's holds until they're Given Away; an Inventory Item's next one.
      held: kind === "gift" ? sum(held) : null,
      next: kind === "inventory" ? soonest(held) : null,
    };
  });
  return { locations, categories, items: window ? items.filter((i) => i.available! > 0) : items, availableFor: window };
}

/** What an Inventory Item's soonest Hold Window holds, and the day it starts. */
function soonest(holds: Hold[]) {
  const from = holds.flatMap((h) => (h.window ? [h.window.from] : [])).sort()[0];
  if (!from) return null;
  return { reserved: sum(holds.filter((h) => h.window?.from === from)), from };
}

// The item's one Location (ADR 0014).
const whereItSits = sql<string | null>`(
  select ${location.name} from ${stock} as held inner join ${location} on ${location.id} = held.location_id
  where held.item_id = ${item.id})`;
