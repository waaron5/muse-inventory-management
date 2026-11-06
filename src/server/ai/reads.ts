import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { ReadDb } from "@/db/types";
import { activityAreas, sentenceText } from "@/lib/activity";
import { formatPrice, formatTime } from "@/lib/format";
import { todayInMuse } from "@/lib/time-zone";
import { ACTIVITY_PAGE, loadActivityScreen } from "../loaders/activity";
import { loadAiAvailability } from "../loaders/ai-availability";
import { loadCategoriesScreen } from "../loaders/categories";
import { loadEventScreen } from "../loaders/event";
import { loadEventsScreen } from "../loaders/events";
import { loadCatalogItem } from "../loaders/item";
import { loadLocationsScreen } from "../loaders/locations";
import { answer, refused } from "./answers";
import { appLinks } from "./links";

// The reads an AI Connection answers with (ADR 0017), each through the
// screen's own loader, so its numbers are the ones on screen. Roles never limit
// seeing, so Unit Prices and P&L Codes come too. Each links to its page.

/** What every tool that reads or takes a date says about it (ADR 0005). */
export const DATES = "Dates are calendar days in Muse's time zone (America/Denver), written YYYY-MM-DD.";

/** How many History entries the item tool gives, newest first. */
export const RECENT_HISTORY = 20;

/** The most Activity entries one call gives; still bounded. */
export const MOST_ACTIVITY = 200;

const id = (what: string) => z.uuid(`Use the id of ${what} from search.`);
const day = z.iso.date("Write the date as YYYY-MM-DD.");
const read = { readOnlyHint: true, openWorldHint: false } as const;

/** Adds the read tools to an AI Connection's MCP server. */
export function registerReads(server: McpServer, db: ReadDb, appURL: string) {
  const links = appLinks(appURL);
  const linked = <E extends { id: string }>(e: E) => ({ ...e, link: links.event(e.id) });

  server.registerTool(
    "item",
    {
      title: "One Inventory Item or Gift",
      description: `One Inventory Item or Gift by its id: its details and Unit Price, Count, Location and Category, the Events it's reserved for from today on (a Gift's until it's Given Away), and its ${RECENT_HISTORY} most recent History entries. ${DATES}`,
      inputSchema: z.object({ id: id("an Inventory Item or Gift") }),
      annotations: read,
    },
    async (input) => {
      const found = await loadCatalogItem(db, input.id);
      if (!found) return refused("No Inventory Item or Gift has that id. Search for it first.");
      return answer({
        id: found.item.id,
        kind: found.item.kind,
        name: found.item.name,
        sku: found.item.sku,
        description: found.item.description,
        unitPrice: price(found.item.unitPriceCents),
        category: found.item.categoryName,
        archived: found.item.archived,
        count: found.count,
        location: found.location?.name ?? null,
        reservedFor: found.upcoming.map((u) => ({ event: linked(u.event), reserved: u.reserved, shortBy: u.shortBy })),
        recentHistory: found.history
          .slice(0, RECENT_HISTORY)
          .map(({ kind: entry, reason, count, from, to, event, by, note, happenedOn }) => ({
            kind: entry,
            reason,
            count,
            from,
            to,
            // By name only, as on its page: the Event may since have been deleted.
            event: event?.name ?? null,
            by,
            note,
            happenedOn,
          })),
        moreHistory: found.history.length > RECENT_HISTORY,
        link: links.item(found.item),
      });
    },
  );

  server.registerTool(
    "availability",
    {
      title: "What's Available",
      description: `How many of some items are Available, with any Shortage. Ask about items by id (Inventory Items or Gifts), or about every Inventory Item in a Category, Archived ones left out unless asked for. Ask over given dates (from, and to for more than one day), or over an Event's Hold Window (its dates) by its id. An Inventory Item's Available is its Count less what other Events hold on the busiest day; it has none over an Event without dates. A Gift's is its Count less every other Event's hold not yet Given Away, whatever the dates. Below 0 is a Shortage. Each item lists the other Events holding it. ${DATES}`,
      inputSchema: z.object({
        itemIds: z.array(id("an Inventory Item or Gift")).min(1).max(100).optional().describe("The items to ask about"),
        categoryId: id("a Category").optional().describe("Or every Inventory Item in this Category"),
        includeArchived: z.boolean().optional().describe("With categoryId: list Archived Inventory Items too"),
        from: day.optional().describe("The first day asked about"),
        to: day.optional().describe("The last day asked about; leave out for one day"),
        eventId: id("an Event").optional().describe("Or over this Event's Hold Window"),
      }),
      annotations: read,
    },
    async ({ itemIds, categoryId, includeArchived, from, to, eventId }) => {
      if (Boolean(itemIds) === Boolean(categoryId)) return refused("Give either itemIds or categoryId.");
      if (Boolean(from) === Boolean(eventId)) return refused("Give either the dates (from, and to) or an eventId.");
      const items = itemIds ? { itemIds } : { categoryId: categoryId!, archived: includeArchived };
      const found = await loadAiAvailability(db, { ...items, ...(eventId ? { eventId } : { from: from!, to }) });
      if (!found) return refused("No Event has that id. Search for it first.");
      const over = "event" in found.over ? { ...found.over, event: linked(found.over.event) } : found.over;
      return answer({
        over,
        items: found.items.map(({ heldBy, ...thing }) => ({
          ...thing,
          heldBy: heldBy.map((h) => ({ ...h, event: linked(h.event) })),
          link: links.item(thing),
        })),
      });
    },
  );

  server.registerTool(
    "events",
    {
      title: "List Events",
      description: `Events, as the Events list shows them: Upcoming (through their last day, and those without dates) soonest first, or Past or Cancelled most recent first. Narrow them to one Client (its id from search) or to the Events overlapping one month. Each has its Client, P&L Code, Venue, dates, how many Inventory and Gift Lines it has, and its worst Shortage not yet Acknowledged. ${DATES}`,
      inputSchema: z.object({
        status: z.enum(["upcoming", "past", "cancelled"]).optional().describe("Upcoming when left out"),
        clientId: id("a Client").optional(),
        month: z
          .string()
          .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Write the month as YYYY-MM.")
          .optional()
          .describe("YYYY-MM: Events overlapping this month"),
      }),
      annotations: read,
    },
    async ({ status = "upcoming", clientId, month }) => {
      const { counts, events } = await loadEventsScreen(db, { tab: status, clientId, month });
      const list = new URL(links.to("/events"));
      if (status !== "upcoming") list.searchParams.set("tab", status);
      if (clientId) list.searchParams.set("client", clientId);
      if (month) list.searchParams.set("month", month);
      return answer({
        status,
        counts,
        events: events.map((e) =>
          linked({
            id: e.id,
            name: e.name,
            client: e.client.name,
            plCode: e.plCode,
            venue: e.venue,
            startsOn: e.startsOn,
            endsOn: e.endsOn,
            lines: e.lines,
            shortBy: e.shortBy,
          }),
        ),
        link: list.toString(),
      });
    },
  );

  server.registerTool(
    "event",
    {
      title: "One Event",
      description: `One Event by its id: its Client, P&L Code, Venue, dates and notes; its Lines (Inventory Items and Borrowed Items under inventory, Gifts under gifts), each with its lineId, how many are reserved and who added it; and its Shortages, flagged until an Admin Acknowledges them. ${DATES}`,
      inputSchema: z.object({ id: id("an Event") }),
      annotations: read,
    },
    async (input) => {
      const found = await loadEventScreen(db, input.id);
      if (!found) return refused("No Event has that id. Search for it first.");
      const lineOf = (l: (typeof found.inventory)[number]) => ({
        // What changeReserved and removeLine take.
        lineId: l.id,
        name: l.name,
        kind: l.kind === "borrowed" ? "borrowed" : "reservation",
        // A Borrowed Item has no item; a deleted one has no page.
        item: l.item && !l.deleted ? { id: l.item.id, kind: l.item.kind, unitPrice: price(l.item.unitPriceCents), link: links.item(l.item) } : null,
        deleted: l.deleted,
        reserved: l.reserved,
        givenAway: l.givenAway,
        lender: l.lender,
        addedBy: l.addedBy && { name: l.addedBy.name, on: l.addedBy.on },
      });
      // A Shortage can be of an Inventory Item or a Gift: its Line says which.
      const kinds = new Map([...found.inventory, ...found.gifts].flatMap((l) => (l.item ? [[l.item.id, l.item.kind] as const] : [])));
      return answer({
        id: found.id,
        name: found.name,
        client: { name: found.client.name, link: found.client.id ? links.client(found.client.id) : null },
        plCode: found.plCode,
        venue: found.venue,
        notes: found.notes,
        startsOn: found.startsOn,
        endsOn: found.endsOn,
        holdWindow: found.holdWindow,
        cancelled: found.cancelled,
        ended: found.ended,
        inventory: found.inventory.map(lineOf),
        gifts: found.gifts.map(lineOf),
        shortages: found.shortages.map((s) => ({
          item: { ...s.item, link: links.item({ id: s.item.id, kind: kinds.get(s.item.id) ?? "inventory" }) },
          shortBy: s.shortBy,
          flagged: s.flagged,
          competing: s.competing.map((c) => ({ event: linked(c.event), reserved: c.reserved })),
          acknowledged: s.acknowledged && { shortBy: s.acknowledged.shortBy, note: s.acknowledged.note, by: s.acknowledged.by },
        })),
        reservedValue: formatPrice(found.reservedCents),
        link: links.event(found.id),
      });
    },
  );

  server.registerTool(
    "activity",
    {
      title: "Recent Activity",
      description: `Recent Activity, newest first: every change anyone made, as one sentence after the person's name, with the day and time it was recorded in Muse's time zone, and the AI app it was done through, if any. Narrow it to Events, the catalog, Stock or people. ${DATES}`,
      inputSchema: z.object({
        area: z.enum(activityAreas).optional().describe("Only Events, catalog, Stock or people changes"),
        limit: z.int().min(1).max(MOST_ACTIVITY).optional().describe(`How many, ${ACTIVITY_PAGE} when left out`),
      }),
      annotations: read,
    },
    async ({ area, limit }) => {
      const { entries, more } = await loadActivityScreen(db, { area, show: limit });
      const mentionLink = (part: Exclude<(typeof entries)[number]["sentence"][number], string>) => {
        // As on the Activity page, only an Event or item still there links to its page.
        if (!part.live) return null;
        return part.ref === "event" ? links.event(part.id) : links.item({ id: part.id, kind: part.itemKind ?? "inventory" });
      };
      return answer({
        entries: entries.map((e) => ({
          by: e.by?.name ?? "Automatic",
          ...(e.viaAi ? { viaAi: e.viaAi } : {}),
          did: sentenceText(e.sentence),
          day: todayInMuse(e.recordedAt),
          time: formatTime(e.recordedAt),
          mentions: e.sentence.flatMap((part) => (typeof part === "string" ? [] : [{ kind: part.ref, name: part.name, link: mentionLink(part) }])),
        })),
        more,
        link: links.to(area ? `/activity?type=${area}` : "/activity"),
      });
    },
  );

  server.registerTool(
    "locations",
    {
      title: "Locations",
      description: "Every Location, by name, with how much Stock it holds. Use one of these when a change names a Location.",
      inputSchema: z.object({}),
      annotations: read,
    },
    async () => {
      const { locations } = await loadLocationsScreen(db);
      return answer({ locations: locations.map((l) => ({ id: l.id, name: l.name, stock: l.holds })), link: links.to("/settings#locations") });
    },
  );

  server.registerTool(
    "categories",
    {
      title: "Categories",
      description: "Every Category of Inventory Item, by name, with how many Inventory Items are in it, Archived ones included. Use one of these when a change names a Category.",
      inputSchema: z.object({}),
      annotations: read,
    },
    async () => {
      const { categories } = await loadCategoriesScreen(db);
      return answer({ categories, link: links.to("/settings#categories") });
    },
  );

  return server;
}

function price(cents: number | null) {
  return cents === null ? null : formatPrice(cents);
}
