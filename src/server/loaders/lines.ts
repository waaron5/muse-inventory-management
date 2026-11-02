import { asc, sql } from "drizzle-orm";
import { item, line } from "@/db/schema";
import { historicalName } from "../deleted-records";

// An Event's Lines as every screen lists them. Read with `item` left-joined:
// a Borrowed Item has no item.

/** A Line's name: its item's, or the one typed for a Borrowed Item. */
export const lineName = sql<string>`coalesce(${historicalName("item", line.itemId, item.name)}, ${line.name})`;

/** Reservations by name, then those entered by hand by name. */
export const linesInOrder = [asc(sql`${line.kind} <> 'reservation'`), asc(lineName)];

/**
 * Which of an Event's sections a Line falls into: its Inventory (Inventory
 * Items and Borrowed Items) or its Gifts.
 */
export function inSection(l: { item: { kind: "inventory" | "gift" } | null }) {
  return l.item?.kind ?? "inventory";
}
