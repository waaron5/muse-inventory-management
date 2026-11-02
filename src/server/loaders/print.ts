import { historicalName } from "../deleted-records";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { client, event, item, line } from "@/db/schema";
import { clientColour } from "@/lib/client-colour";
import { stockFor } from "./availability";
import { defineLoader } from "./define";
import { lineName } from "./lines";

type Row = { name: string; count: number };

/** By Location, the way the crew walks the shelves, or one list A–Z. */
export type PrintOrder = "by-location" | "a-z";

/** Where what there's no Stock for is listed. */
const NOT_IN_STOCK = "Not in stock";

// One round trip: the Event and its Client, its Lines, and where their items'
// Stock sits, side by side. Paper is a working copy of everything the Event
// needs: Inventory and Gifts share the list, each under its Location (ADR
// 0014), and what there's no Stock for under Not in stock. A
// Borrowed Item is listed under its lender.
export const loadPrintScreen = defineLoader("print", async (db, id: string, order: PrintOrder = "by-location") => {
  if (!z.uuid().safeParse(id).success) return null;
  const [[found], lines, stockRows] = await Promise.all([
    db
      .select({ id: event.id, name: event.name, client: { name: historicalName("client", event.clientId, client.name) }, clientColour: client.colour })
      .from(event)
      .leftJoin(client, eq(client.id, event.clientId))
      .where(eq(event.id, id)),
    db
      .select({ itemId: line.itemId, kind: line.kind, name: lineName, lender: line.lender, count: line.reserved })
      .from(line)
      .leftJoin(item, eq(item.id, line.itemId))
      .where(eq(line.eventId, id))
      .orderBy(asc(lineName)),
    stockFor(db, id),
  ]);
  if (!found) return null;

  const byLocation = new Map<string, Row[]>();
  const byLender = new Map<string, Row[]>();
  const notInStock: Row[] = [];
  // Each item's whole count, A–Z as the Lines came.
  const totals: Row[] = [];
  for (const l of lines) {
    const row = { name: l.name, count: l.count };
    if (l.kind === "borrowed") {
      add(byLender, l.lender || "Borrowed Items", row);
      continue;
    }
    totals.push(row);
    // As many as its Location holds; the rest are Not in stock.
    let left = l.count;
    for (const s of stockRows.filter((s) => s.itemId === l.itemId)) {
      const here = Math.min(left, s.count);
      if (here > 0) add(byLocation, s.name, { name: l.name, count: here });
      left -= here;
    }
    if (left > 0) notInStock.push({ name: l.name, count: left });
  }

  const group = (heading: string, rows: Row[]) => (rows.length ? [{ heading, rows }] : []);
  return {
    id: found.id,
    name: found.name,
    client: { name: found.client.name, colour: found.clientColour ?? clientColour(found.client.name) },
    // Locations first, or one list with no heading, then lenders, each A–Z.
    groups: [
      ...(order === "a-z"
        ? totals.length
          ? [{ heading: null, rows: totals }]
          : []
        : [...inOrder(byLocation), ...group(NOT_IN_STOCK, notInStock)]),
      ...inOrder(byLender),
    ],
  };
});

function add(groups: Map<string, Row[]>, heading: string, row: Row) {
  groups.set(heading, [...(groups.get(heading) ?? []), row]);
}

function inOrder(groups: Map<string, Row[]>) {
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([heading, rows]) => ({ heading, rows }));
}
