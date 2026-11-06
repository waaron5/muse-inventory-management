import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { event, item, line } from "@/db/schema";
import type { Tx } from "@/db/types";
import { todayInMuse } from "@/lib/time-zone";
import { CommandError } from "../errors";
import { inStorageOf, stillReserves } from "../loaders/availability";
import { ref, said } from "./activity";
import { defineCommand } from "./define";

// An Admin retires an Inventory Item or Gift from the catalog and booking,
// its History kept, once it has no Stock and nothing reserved. Any
// Stock left is adjusted away first (Stock and locations model).

const anItem = z.object({ id: z.uuid("That item no longer exists.") });

export const archiveItem = defineCommand({
  name: "archiveItem",
  input: anItem,
  allow: ["admin"],
  ai: {
    description:
      "Archives an Inventory Item or Gift: retires it from use, keeping its History, until it's Unarchived. Only once it has no Stock and nothing reserved. Admins only.",
  },
  run: async (tx, _actor, { id }, record) => {
    const found = await lockItem(tx, id);
    if (found.archived) throw new CommandError("invalid", `${found.name} is already Archived.`);
    if (found.inStorage > 0) {
      throw new CommandError(
        "invalid",
        `${found.name} still has ${found.inStorage} in storage. Adjust its count to none before archiving.`,
      );
    }
    const [holding] = await reservedFor(tx, id);
    if (holding) {
      throw new CommandError("invalid", `${found.name} is reserved for ${holding.name}. Remove it there before archiving.`);
    }
    await tx.update(item).set({ archivedAt: new Date() }).where(eq(item.id, id));
    await record("catalog", said`archived ${ref.item(id, found.name, found.kind)}`);
  },
});

export const unarchiveItem = defineCommand({
  name: "unarchiveItem",
  input: anItem,
  allow: ["admin"],
  ai: {
    description:
      "Unarchives an Inventory Item or Gift, putting it back in use. Admins only.",
  },
  run: async (tx, _actor, { id }, record) => {
    const found = await lockItem(tx, id);
    if (!found.archived) throw new CommandError("invalid", `${found.name} isn't Archived.`);
    await tx.update(item).set({ archivedAt: null }).where(eq(item.id, id));
    await record("catalog", said`unarchived ${ref.item(id, found.name, found.kind)}`);
  },
});

/**
 * The item, locked until this saves: a Reservation and Stock landing on it
 * hold it shared, so neither slips in under an archive.
 */
async function lockItem(tx: Tx, id: string) {
  const [found] = await tx
    .select({
      name: item.name,
      kind: item.kind,
      archived: sql<boolean>`${item.archivedAt} is not null`,
      inStorage: inStorageOf(item.id),
    })
    .from(item)
    .where(eq(item.id, id))
    .for("update");
  if (!found) throw new CommandError("invalid", "That item no longer exists.");
  return found;
}

// The Events still reserving it.
function reservedFor(tx: Tx, id: string) {
  return tx
    .select({ name: event.name })
    .from(line)
    .innerJoin(event, eq(event.id, line.eventId))
    .innerJoin(item, eq(item.id, line.itemId))
    .where(
      and(eq(line.itemId, id), stillReserves(todayInMuse())),
    )
    .orderBy(asc(event.name))
    .limit(1);
}
