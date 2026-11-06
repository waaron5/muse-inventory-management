import * as Sentry from "@sentry/nextjs";
import type { McpServer, StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { event, item, stock } from "@/db/schema";
import type { Db, ReadDb } from "@/db/types";
import { type ActivityPart, sentenceText } from "@/lib/activity";
import { allCommands } from "../commands/all";
import type { Command } from "../commands/define";
import { CommandError } from "../errors";
import { loadEventScreen } from "../loaders/event";
import type { Delivery } from "../mail";
import type { AiConnection } from "./connection";
import { answer, refused } from "./answers";
import { appLinks, type AppLinks } from "./links";

// Every command an AI Connection may run is a tool of the same name (ADR 0017),
// run as its person through the command itself, so role checks, History and
// Activity are as on screen. A tool says what changed as its Activity sentence
// does, with links, and a refusal is the command's own message.

export type ChangeDeps = { db: Db; appURL: string; connection: AiConnection; sendInvite: (to: string) => Promise<Delivery> };

/**
 * Where a tool takes different arguments from its command's form: `input` is
 * what the AI is shown, and `fill` turns what it sent into the command's input.
 * The command still checks it, so a refusal is in its own words.
 */
type Adapter = { input: z.ZodObject; fill?: (db: ReadDb, given: Record<string, unknown>) => Promise<unknown> };

const id = (what: string) => z.uuid().describe(`The id of ${what}, from search or the reads`);
const startingStock = z
  .object({ locationId: id("a Location"), count: z.int().min(0).describe("How many there are") })
  .optional()
  .describe("Where it's kept and how many: Unassigned with none when left out");
const catalogFields = {
  name: z.string(),
  sku: z.string().optional(),
  unitPrice: z.string().optional().describe('In dollars, like "24.99"'),
  description: z.string().optional(),
};
const changeable = (fields: z.ZodRawShape) =>
  Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, (field as z.ZodType).optional()]));

// Catalog items are added without a photo: photos stay in the app.
const createItem = (fields: z.ZodRawShape): Adapter => ({
  input: z.object({ ...catalogFields, ...fields, startingStock }),
  fill: async (_db, given) => Object.fromEntries(Object.entries(given).filter(([key]) => key !== "photo")),
});

// An edit sends every field on screen; an AI sends only what it changes.
const editItem = (kind: "inventory" | "gift"): Adapter => ({
  input: z.object({
    id: id(kind === "gift" ? "the Gift" : "the Inventory Item"),
    ...changeable(catalogFields),
    ...(kind === "inventory" ? { categoryId: id("a Category").optional() } : {}),
    locationId: id("a Location").optional().describe("Moves all of its Stock there"),
    count: z.int().min(0).optional().describe("What was counted: a Recount"),
  }),
  fill: async (db, { locationId, count, ...given }) => {
    const itemId = anId(given.id);
    if (!itemId) return given;
    const [current] = await db
      .select({ name: item.name, sku: item.sku, unitPriceCents: item.unitPriceCents, description: item.description, categoryId: item.categoryId, locationId: stock.locationId, count: stock.count })
      .from(item)
      .leftJoin(stock, eq(stock.itemId, item.id))
      .where(eq(item.id, itemId));
    if (!current) return given;
    const stockAsked = locationId !== undefined || count !== undefined;
    return {
      name: current.name,
      sku: current.sku ?? undefined,
      unitPrice: current.unitPriceCents === null ? undefined : (current.unitPriceCents / 100).toFixed(2),
      description: current.description ?? undefined,
      ...(kind === "inventory" ? { categoryId: current.categoryId ?? undefined } : {}),
      ...defined(given),
      ...(stockAsked && current.locationId !== null
        ? { stock: { locationId: locationId ?? current.locationId, count: count ?? current.count, expectedCount: current.count } }
        : {}),
    };
  },
});

const client = z
  .union([z.object({ id: id("a Client") }), z.object({ name: z.string().describe("A new Client's name") })])
  .describe("The Client: its id from search, or a new one's name");
const eventFields = {
  name: z.string(),
  client,
  plCode: z.string().optional().describe("Its P&L Code: one Event's only"),
  venue: z.string().optional(),
  notes: z.string().optional(),
  startsOn: z.iso.date().optional().describe("YYYY-MM-DD"),
  endsOn: z.iso.date().optional().describe("YYYY-MM-DD; leave out for one day"),
};

const ADAPTERS: Partial<Record<keyof typeof allCommands, Adapter>> = {
  // One flat object rather than a union by reason, which not every AI app reads.
  adjustStock: {
    input: z.object({
      itemId: id("the Inventory Item or Gift"),
      reason: z.enum(["purchased", "found", "lost", "damaged", "recount", "given-away"]),
      count: z.int().min(1).optional().describe("How many were added or taken; every reason but recount"),
      countedTo: z.int().min(0).optional().describe("With recount: how many were counted"),
      note: z.string().optional().describe("Why; with given-away, who it went to"),
      happenedOn: z.iso.date().optional().describe("The day it happened, YYYY-MM-DD; today when left out"),
    }),
  },
  createInventoryItem: createItem({ categoryId: id("a Category") }),
  createGift: createItem({}),
  editInventoryItem: editItem("inventory"),
  editGift: editItem("gift"),
  createEvent: { input: z.object(eventFields) },
  editEvent: {
    input: z.object({ id: id("the Event"), ...changeable(eventFields) }),
    fill: async (db, given) => {
      const eventId = anId(given.id);
      if (!eventId) return given;
      const [current] = await db
        .select({ name: event.name, clientId: event.clientId, plCode: event.plCode, venue: event.venue, notes: event.notes, startsOn: event.startsOn, endsOn: event.endsOn })
        .from(event)
        .where(eq(event.id, eventId));
      if (!current) return given;
      const { clientId, ...fields } = current;
      return {
        ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value ?? undefined])),
        client: { id: clientId },
        ...defined(given),
      };
    },
  },
};

// An id to look up; anything else goes to the command as sent, to be refused there.
function anId(value: unknown) {
  return z.uuid().safeParse(value).data;
}

// What the AI left out is left as it is.
function defined(given: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(given).filter(([, value]) => value !== undefined));
}

/** Adds a tool for every command an AI Connection may run. */
export function registerChanges(server: McpServer, deps: ChangeDeps) {
  const links = appLinks(deps.appURL);
  for (const [name, command] of Object.entries(allCommands) as [keyof typeof allCommands, Command][]) {
    const { ai } = command.spec;
    if (ai === false) continue;
    const adapter = ADAPTERS[name];
    server.registerTool(
      name,
      {
        description: ai.description,
        inputSchema: asSent(adapter?.input ?? command.spec.input),
        annotations: { readOnlyHint: false, openWorldHint: name === "inviteUser" },
      },
      async (args) => {
        const given = args as Record<string, unknown>;
        try {
          const input = adapter?.fill ? await adapter.fill(deps.db, given) : given;
          const done = await command.withActivity(deps.db, { userId: deps.connection.userId, aiTokenId: deps.connection.aiTokenId }, input as never);
          return answer({ ...(await said(deps, links, done.activity?.sentence ?? null)), ...(done.output ? { result: done.output } : {}), ...(await after(name, deps, input)) });
        } catch (error) {
          if (error instanceof CommandError) return refused(error.message);
          Sentry.captureException(error);
          return refused(`Something went wrong. Try again, or do it in Muse Inventory: ${deps.appURL}`);
        }
      },
    );
  }
  return server;
}

// What changed, as the Activity page says it, with a link to each Event or item
// it names; and any Shortage now flagged on an Event it names: of the items it
// names, or of any item when it names none (new dates, say).
async function said(deps: ChangeDeps, links: AppLinks, sentence: ActivityPart[] | null) {
  if (!sentence) return { done: "Nothing changed: it was already so." };
  const mentions = sentence.flatMap((part) => (typeof part === "string" ? [] : [part]));
  const events = [...new Set(mentions.filter((m) => m.ref === "event").map((m) => m.id))];
  const items = new Set(mentions.filter((m) => m.ref === "item").map((m) => m.id));
  const screens = await Promise.all(events.map((id) => loadEventScreen(deps.db, id)));
  const shortages = screens.flatMap((found) =>
    found
      ? found.shortages
          .filter((s) => s.flagged && (items.size === 0 || items.has(s.item.id)))
          .map((s) => ({
            item: { id: s.item.id, name: s.item.name, link: links.item({ id: s.item.id, kind: kindOf(found, s.item.id) }) },
            event: { name: found.name, link: links.event(found.id) },
            shortBy: s.shortBy,
          }))
      : [],
  );
  return {
    done: `${deps.connection.name} ${sentenceText(sentence)}`,
    mentions: mentions.map((m) => ({
      kind: m.ref,
      name: m.name,
      ...(m.ref === "event" ? { link: links.event(m.id) } : m.ref === "item" ? { link: links.item({ id: m.id, kind: m.itemKind ?? "inventory" }) } : {}),
    })),
    ...(shortages.length ? { shortages } : {}),
  };
}

type EventScreen = NonNullable<Awaited<ReturnType<typeof loadEventScreen>>>;
function kindOf(found: EventScreen, itemId: string) {
  return found.gifts.some((l) => l.item?.id === itemId) ? ("gift" as const) : ("inventory" as const);
}

// What happens after a command, as its Server Action does.
async function after(name: keyof typeof allCommands, deps: ChangeDeps, input: unknown) {
  if (name !== "inviteUser") return {};
  const email = z.object({ email: z.string().trim().toLowerCase() }).parse(input).email;
  const delivery = await deps.sendInvite(email);
  return {
    email: delivery === "failed" ? `The invite email didn't go out: tell them to sign in at ${deps.appURL}` : "Emailed them how to sign in.",
  };
}

/**
 * A tool's schema as the AI is shown it, letting what it sent through as sent:
 * the command checks it, and refuses in its own words, rather than the SDK.
 */
function asSent(schema: z.ZodType): StandardSchemaWithJSON<Record<string, unknown>> {
  const standard = (schema as unknown as StandardSchemaWithJSON)["~standard"];
  return {
    "~standard": {
      version: 1,
      vendor: "muse",
      validate: (value) => ({ value: (value ?? {}) as Record<string, unknown> }),
      jsonSchema: standard.jsonSchema,
    },
  };
}
