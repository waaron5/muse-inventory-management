import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { type AiSearchResults, loadAiSearch } from "../loaders/ai-search";
import { type ChangeDeps, registerChanges } from "./changes";
import { appLinks } from "./links";
import { DATES, registerReads } from "./reads";

/**
 * What every AI app is told when it connects: Muse's words (CONTEXT.md), to
 * ask rather than guess, and that some things stay in the app (ADR 0017).
 */
export const INSTRUCTIONS = `Muse Inventory is Muse's record of what it owns, where it is, and which Events it goes to. You act as the person who connected you: you see what they can see.

Use Muse's own words:
- Inventory Item: something reusable Muse sends to Events again and again (not "asset", "equipment" or "product").
- Gift: something given away at an Event and gone (not "swag" or "giveaway").
- Event: one engagement Muse runs for a Client, with its dates, P&L Code and Venue (not "job", "project" or "show").
- Client: the company or person an Event is for (not "customer" or "account").
- Location: where an item is kept. Category: the kind of Inventory Item. Count: how many there are.
- Archived: retired from use but kept (not "deleted").

Never guess between matches. When a search finds more than one thing that could be meant, list them with what tells them apart (the Client and dates of an Event; the Location, Category and Count of an item) and ask which one. Only go ahead when exactly one matches. When a search says there are more, ask for something more specific.

${DATES} "Today" is today in Denver.

Give the link of anything you mention, so the person can open it in Muse Inventory.

Changes are made as the person, and only what their role allows: when a change says only an Admin can do it, tell them so. Do a list one item at a time, one call each, then say which went through and which didn't, and why. A Reservation for more than is Available still saves: say which Shortage it caused.

Some things can only be done in the app: deleting anything, managing people beyond inviting them, merging Clients, Acknowledging Shortages, and photos. When asked for one of those, say it's done in Muse Inventory and give the link to where.`;

/** The MCP server one AI Connection talks to, for one request: its reads, and its changes as its person. */
export function mcpServer(deps: ChangeDeps) {
  const { db, appURL } = deps;
  const server = new McpServer({ name: "muse-inventory", title: "Muse Inventory", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "search",
    {
      title: "Search Muse Inventory",
      description:
        "Finds Inventory Items, Gifts, Events and Clients by name or SKU (Events also by P&L Code, Client or Venue). Each result has what tells it apart from the others and a link to its page.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(100).describe("A name or SKU, or part of one"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query }) => {
      const found = withLinks(await loadAiSearch(db, query), appURL);
      return { content: [{ type: "text", text: JSON.stringify(found) }] };
    },
  );

  registerReads(server, db, appURL);
  return registerChanges(server, deps);
}

// Every result links to its page in the app; a Client's is its Events.
function withLinks(results: AiSearchResults, appURL: string) {
  const links = appLinks(appURL);
  return {
    inventoryItems: {
      ...results.inventory,
      found: results.inventory.found.map((i) => ({ ...i, link: links.item({ id: i.id, kind: "inventory" }) })),
    },
    gifts: {
      ...results.gifts,
      // Gifts have no Category.
      found: results.gifts.found.map(({ id, name, sku, location, count, archived }) => ({ id, name, sku, location, count, archived, link: links.item({ id, kind: "gift" }) })),
    },
    events: { ...results.events, found: results.events.found.map((e) => ({ ...e, link: links.event(e.id) })) },
    clients: { ...results.clients, found: results.clients.found.map((c) => ({ ...c, link: links.client(c.id) })) },
  };
}
