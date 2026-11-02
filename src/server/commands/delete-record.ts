import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { client, historyEntry, item, location, pastUsePhoto, shortageAcknowledgement, shortageAcknowledgementEvent, stock } from "@/db/schema";
import { UNASSIGNED_LOCATION } from "@/lib/stock";
import { remember } from "../deleted-records";
import { CommandError } from "../errors";
import { museToday } from "../today";
import { ref, said } from "./activity";
import { defineCommand } from "./define";
import { ensureUnassigned } from "./stock";

const target = z.object({ id: z.uuid("That record no longer exists.") });

export const deleteItem = defineCommand({
  name: "deleteItem",
  input: target,
  allow: ["admin"],
  run: async (tx, actor, { id }, record) => {
    const [found] = await tx.select().from(item).where(eq(item.id, id)).for("update");
    if (!found) throw new CommandError("invalid", "That item no longer exists.");
    await remember(tx, { id, kind: "item", name: found.name, details: { itemKind: found.kind } });
    const balances = await tx.select().from(stock).where(eq(stock.itemId, id)).orderBy(asc(stock.locationId)).for("update");
    for (const balance of balances) {
      if (balance.count > 0) await tx.insert(historyEntry).values({
        itemId: id, kind: "adjustment", reason: "recount", count: balance.count,
        fromLocationId: balance.locationId, byUserId: actor.userId, happenedOn: museToday,
        note: "Item deleted",
      });
    }
    await tx.delete(stock).where(eq(stock.itemId, id));
    const acknowledgements = tx.select({ id: shortageAcknowledgement.id }).from(shortageAcknowledgement).where(eq(shortageAcknowledgement.itemId, id));
    await tx.delete(shortageAcknowledgementEvent).where(inArray(shortageAcknowledgementEvent.acknowledgementId, acknowledgements));
    await tx.delete(shortageAcknowledgement).where(eq(shortageAcknowledgement.itemId, id));
    await tx.delete(pastUsePhoto).where(eq(pastUsePhoto.itemId, id));
    await tx.delete(item).where(eq(item.id, id));
    await record("catalog", said`deleted ${ref.item(id, found.name, found.kind)}`);
  },
});

export const deleteLocation = defineCommand({
  name: "deleteLocation",
  input: target,
  allow: ["admin"],
  run: async (tx, actor, { id }, record) => {
    if (id === UNASSIGNED_LOCATION) throw new CommandError("invalid", "Unassigned Stock needs a Location.");
    const [found] = await tx.select().from(location).where(eq(location.id, id)).for("update");
    if (!found) throw new CommandError("invalid", "That Location no longer exists.");
    await remember(tx, { id, kind: "location", name: found.name });
    const balances = await tx.select().from(stock).where(eq(stock.locationId, id)).orderBy(asc(stock.itemId)).for("update");
    if (balances.length > 0) await ensureUnassigned(tx);
    // Each item keeps its one balance, now Unassigned; an Archived item too,
    // since no catalog fields change.
    await tx.update(stock).set({ locationId: UNASSIGNED_LOCATION }).where(eq(stock.locationId, id));
    for (const balance of balances) {
      if (balance.count === 0) continue;
      await tx.insert(historyEntry).values({
        itemId: balance.itemId, kind: "transfer", count: balance.count,
        fromLocationId: id, toLocationId: UNASSIGNED_LOCATION,
        byUserId: actor.userId, happenedOn: museToday, note: "Location deleted",
      });
    }
    await tx.delete(location).where(eq(location.id, id));
    await record("stock", said`deleted Location ${ref.location(id, found.name)}`);
  },
});

export const deleteClient = defineCommand({
  name: "deleteClient",
  input: target,
  allow: ["admin"],
  run: async (tx, _actor, { id }, record) => {
    const [found] = await tx.select().from(client).where(eq(client.id, id)).for("update");
    if (!found) throw new CommandError("invalid", "That Client no longer exists.");
    await remember(tx, { id, kind: "client", name: found.name });
    await tx.delete(client).where(eq(client.id, id));
    await record("events", said`deleted Client ${ref.client(id, found.name)}`);
  },
});
