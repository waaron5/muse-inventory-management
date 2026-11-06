import { historicalName } from "../deleted-records";
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { client, event, item } from "@/db/schema";
import { defineLoader } from "./define";
import { firstDay } from "./events";

// A dropdown's worth of each.
const MAX_EACH = 5;

// One round trip: Events, Inventory Items and Gifts matching the search, side
// by side. Archived items are left out, as everywhere one is picked.
export const loadSearch = defineLoader("search", async (db, q: string) => {
  const term = q.trim();
  if (!term) return { events: [], inventory: [], gifts: [] };
  const like = contains(term);

  const items = (kind: "inventory" | "gift") =>
    db
      .select({ id: item.id, name: item.name, sku: item.sku, photo: item.photo })
      .from(item)
      .where(and(eq(item.kind, kind), isNull(item.archivedAt), or(ilike(item.name, like), ilike(item.sku, like))))
      .orderBy(asc(item.name))
      .limit(MAX_EACH);

  const [events, inventory, gifts] = await Promise.all([
    db
      .select({
        id: event.id,
        name: event.name,
        clientName: historicalName("client", event.clientId, client.name),
        startsOn: event.startsOn,
        endsOn: event.endsOn,
        cancelled: sql<boolean>`${event.cancelledAt} is not null`,
      })
      .from(event)
      .leftJoin(client, eq(client.id, event.clientId))
      .where(
        or(
          ilike(event.name, like),
          ilike(event.plCode, like),
          ilike(historicalName("client", event.clientId, client.name), like),
          ilike(event.venue, like),
        ),
      )
      // Cancelled Events last; otherwise the latest first, as "Cove 26" before "Cove 25".
      .orderBy(sql`${event.cancelledAt} is not null`, sql`${firstDay} desc nulls first`, asc(event.name))
      .limit(MAX_EACH),
    items("inventory"),
    items("gift"),
  ]);
  return { events, inventory, gifts };
});

export type SearchResults = Awaited<ReturnType<typeof loadSearch>>;

/** A search term matched anywhere, taken literally. */
export function contains(term: string) {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
