import { and, eq, ne, sql } from "drizzle-orm";
import { historyEntry, item, location, stock } from "@/db/schema";
import type { Tx } from "@/db/types";
import { CommandError } from "../errors";
import { UNASSIGNED_LOCATION } from "@/lib/stock";
import { museToday } from "../today";

export async function ensureUnassigned(tx: Tx) {
  await tx.insert(location).values({ id: UNASSIGNED_LOCATION, name: "Unassigned" }).onConflictDoNothing();
}

// The balance half of every Stock change (ADR 0004). Each caller writes the
// History entry that explains it in the same transaction.

const balance = (itemId: string, locationId: string) =>
  and(eq(stock.itemId, itemId), eq(stock.locationId, locationId));

/**
 * What a Location holds of an item, locking its balance until the transaction
 * ends so two changes at once are served in turn and the second sees what the
 * first left.
 */
export async function lockStock(tx: Tx, itemId: string, locationId: string) {
  const [held] = await tx.select({ count: stock.count }).from(stock).where(balance(itemId, locationId)).for("update");
  return held?.count ?? 0;
}

/**
 * Where an item's Stock sits and how much there is, its one balance locked
 * until the transaction ends (ADR 0014).
 */
export async function lockItemStock(tx: Tx, itemId: string) {
  const [held] = await tx
    .select({ locationId: stock.locationId, count: stock.count })
    .from(stock)
    .where(eq(stock.itemId, itemId))
    .for("update");
  if (!held) throw new CommandError("invalid", "That item no longer exists.");
  return held;
}

/** A Location's name, for saying why a change was refused. */
export async function locationName(tx: Tx, locationId: string) {
  const [place] = await tx.select({ name: location.name }).from(location).where(eq(location.id, locationId));
  return place?.name ?? "that Location";
}

/** Takes `count` from a Location's Stock, refusing to leave less than none. */
export async function takeStock(tx: Tx, itemId: string, locationId: string, count: number) {
  const have = await lockStock(tx, itemId, locationId);
  if (have < count) {
    const name = await locationName(tx, locationId);
    throw new CommandError("invalid", have === 0 ? `There are none at ${name}.` : `There are only ${have} at ${name}.`);
  }
  await tx
    .update(stock)
    .set({ count: sql`${stock.count} - ${count}` })
    .where(balance(itemId, locationId));
}

/**
 * Adds `count` to a Location's Stock, starting its balance if it has none.
 * The Location and item are held while this saves, so neither disappears
 * underneath it. Nothing lands on an Archived item.
 */
export async function putStock(tx: Tx, itemId: string, locationId: string, count: number) {
  const [found] = await tx
    .select({
      name: item.name,
      archived: sql<boolean>`${item.archivedAt} is not null`,
    })
    .from(location)
    .innerJoin(item, eq(item.id, itemId))
    .where(eq(location.id, locationId))
    .for("share");
  if (!found) throw new CommandError("invalid", "Pick a Location that's still in use.");
  if (found.archived) throw new CommandError("invalid", `${found.name} is Archived. Unarchive it first.`);
  await tx
    .insert(stock)
    .values({ itemId, locationId, count })
    .onConflictDoUpdate({
      target: [stock.itemId, stock.locationId],
      set: { count: sql`${stock.count} + excluded.count` },
    });
}

/**
 * Moves all of an item's Stock to another Location, its balance and all, as a
 * Transfer of the whole Count (ADR 0014). Never to Unassigned: that's where
 * Stock goes only when its Location is deleted.
 */
export async function moveItem(tx: Tx, actor: { userId: string }, itemId: string, fromLocationId: string, toLocationId: string, count: number) {
  const [found] = await tx
    .select({ id: location.id })
    .from(location)
    .where(and(eq(location.id, toLocationId), ne(location.id, UNASSIGNED_LOCATION)))
    .for("share");
  if (!found) throw new CommandError("invalid", "Pick a Location that's still in use.");
  await tx.update(stock).set({ locationId: toLocationId }).where(balance(itemId, fromLocationId));
  if (count > 0) {
    await tx.insert(historyEntry).values({
      itemId,
      kind: "transfer",
      count,
      fromLocationId,
      toLocationId,
      byUserId: actor.userId,
      happenedOn: museToday,
    });
  }
}
