import { type AnyColumn, getTableName, sql, type SQLWrapper, type Table } from "drizzle-orm";
import { deletedRecord } from "@/db/schema";
import type { Tx } from "@/db/types";

type Kind = typeof deletedRecord.$inferInsert.kind;

// Keep correlated columns qualified even in Drizzle's single-table selects.
const outer = (column: AnyColumn) =>
  sql`${sql.identifier(getTableName((column as AnyColumn & { table: Table }).table))}.${sql.identifier(column.name)}`;

export function historicalName(kind: Kind, id: AnyColumn, live: AnyColumn) {
  return sql<string>`coalesce(${live}, (select snapshot.name from deleted_record snapshot where snapshot.kind = ${kind} and snapshot.id = ${outer(id)}::text))`;
}

export function historicalDetail(kind: Kind, id: AnyColumn, key: "itemKind" | "eventId") {
  return sql<string>`(select snapshot.details ->> ${key} from deleted_record snapshot where snapshot.kind = ${kind} and snapshot.id = ${outer(id)}::text)`;
}

export function remember(tx: Tx, value: typeof deletedRecord.$inferInsert) {
  return tx.insert(deletedRecord).values(value);
}

/** An Event referenced by a History entry, even after its Lines were deleted. */
export function historicalEventName(eventName: AnyColumn, eventId: AnyColumn, lineId: AnyColumn) {
  const savedEvent = historicalDetail("line", lineId, "eventId");
  return sql<string | null>`coalesce(${eventName}, (select e.name from event e where e.id::text = ${savedEvent}), (select snapshot.name from deleted_record snapshot where snapshot.kind = 'event' and snapshot.id = coalesce(${outer(eventId)}::text, ${savedEvent})))`;
}

export const snapshotItemKind = (itemId: AnyColumn, kind: SQLWrapper) =>
  sql<"inventory" | "gift" | null>`coalesce(${kind}, ${historicalDetail("item", itemId, "itemKind")})`;
