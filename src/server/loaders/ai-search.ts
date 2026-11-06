import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { category, client, event, item, location, stock } from "@/db/schema";
import { historicalName } from "../deleted-records";
import { defineLoader } from "./define";
import { firstDay } from "./events";
import { contains } from "./search";

/** How many of each kind an AI Connection's search lists. */
export const AI_SEARCH_MAX = 10;

const nothing = { found: [], more: false };

/**
 * An AI Connection's search (ADR 0017): Inventory Items, Gifts, Events and
 * Clients matching a name or SKU, each with enough to tell it from the others,
 * so the AI can ask rather than guess. Unlike global search it keeps Archived
 * records, last, since a person can see those too. One round trip.
 */
export const loadAiSearch = defineLoader("aiSearch", async (db, q: string) => {
  const term = q.trim();
  if (!term) return { inventory: nothing, gifts: nothing, events: nothing, clients: nothing };
  const like = contains(term);
  // One more than is listed, to know whether there are more.
  const limit = AI_SEARCH_MAX + 1;

  const items = (kind: "inventory" | "gift") =>
    db
      .select({
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: category.name,
        location: location.name,
        count: sql<number>`coalesce(${stock.count}, 0)::int`,
        archived: sql<boolean>`${item.archivedAt} is not null`,
      })
      .from(item)
      .leftJoin(category, eq(category.id, item.categoryId))
      .leftJoin(stock, eq(stock.itemId, item.id))
      .leftJoin(location, eq(location.id, stock.locationId))
      .where(and(eq(item.kind, kind), or(ilike(item.name, like), ilike(item.sku, like))))
      .orderBy(sql`${item.archivedAt} is not null`, asc(item.name))
      .limit(limit);

  const clientName = historicalName("client", event.clientId, client.name);
  const [inventory, gifts, events, clients] = await Promise.all([
    items("inventory"),
    items("gift"),
    db
      .select({
        id: event.id,
        name: event.name,
        client: clientName,
        plCode: event.plCode,
        venue: event.venue,
        startsOn: event.startsOn,
        endsOn: event.endsOn,
        cancelled: sql<boolean>`${event.cancelledAt} is not null`,
      })
      .from(event)
      .leftJoin(client, eq(client.id, event.clientId))
      .where(or(ilike(event.name, like), ilike(event.plCode, like), ilike(clientName, like), ilike(event.venue, like)))
      // As global search: Cancelled last, otherwise the latest first.
      .orderBy(sql`${event.cancelledAt} is not null`, sql`${firstDay} desc nulls first`, asc(event.name))
      .limit(limit),
    db
      .select({ id: client.id, name: client.name, archived: sql<boolean>`${client.archivedAt} is not null` })
      .from(client)
      .where(ilike(client.name, like))
      .orderBy(sql`${client.archivedAt} is not null`, asc(sql`lower(${client.name})`))
      .limit(limit),
  ]);
  return { inventory: listed(inventory), gifts: listed(gifts), events: listed(events), clients: listed(clients) };
});

export type AiSearchResults = Awaited<ReturnType<typeof loadAiSearch>>;

function listed<Row>(rows: Row[]) {
  return { found: rows.slice(0, AI_SEARCH_MAX), more: rows.length > AI_SEARCH_MAX };
}
