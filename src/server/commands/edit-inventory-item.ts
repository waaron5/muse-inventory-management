import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { category, historyEntry, item } from "@/db/schema";
import type { ActivityPart } from "@/lib/activity";
import { formatPrice } from "@/lib/format";
import { CommandError } from "../errors";
import { listed, ref, said } from "./activity";
import { defineCommand } from "./define";
import { itemFields } from "./item-fields";
import { locationName, lockItemStock, moveItem, putStock, takeStock } from "./stock";
import { museToday } from "../today";
import { categoryIdField, requireCategory } from "./categories";

// Saving a new Count writes a Recount Adjustment, and a new Location a
// Transfer of all of it, in the same transaction.
export const editInventoryItem = editCatalogItem("inventory", "editInventoryItem");
export const editGift = editCatalogItem("gift", "editGift");

function editCatalogItem(kind: "inventory" | "gift", name: string) {
  return defineCommand({
    name,
    input: z.object({ id: z.uuid("That item no longer exists."), ...itemFields,
      categoryId: categoryIdField,
      // Where it sits and how many, as the form last saw them: moving it moves
      // all of its Stock, and a new Count is a Recount (ADR 0014).
      stock: z.object({
        locationId: z.uuid("Pick a Location that's still in use."),
        count: z.int("Enter a whole number.").min(0, "Count can't be less than 0."),
        expectedCount: z.int().min(0).optional(),
      }).optional(),
    }).refine((input) => kind === "inventory" ? Boolean(input.categoryId) : input.categoryId === undefined, {
      path: ["categoryId"],
      message: kind === "inventory" ? "Select a Category that's still in use." : "Gifts have no Category.",
    }),
    allow: ["admin"],
    run: async (tx, actor, { id, unitPrice, stock: asked, ...fields }, record) => {
      if (fields.categoryId) await requireCategory(tx, fields.categoryId);
      const [current] = await tx
        .select({ name: item.name, sku: item.sku, unitPriceCents: item.unitPriceCents, description: item.description, categoryId: item.categoryId })
        .from(item)
        .where(and(eq(item.id, id), eq(item.kind, kind)));
      // Only what changed, as it is now; long text only says that it changed.
      const changes: ActivityPart[][] = [];
      if (current) {
        if (fields.name !== current.name) changes.push(said`name to ${fields.name}`);
        if ((fields.categoryId ?? null) !== current.categoryId && fields.categoryId) {
          const [now] = await tx.select({ name: category.name }).from(category).where(eq(category.id, fields.categoryId));
          changes.push(said`Category to ${ref.category(fields.categoryId, now.name)}`);
        }
        if (fields.sku !== current.sku) changes.push(said`SKU to ${fields.sku ?? "none"}`);
        if (unitPrice !== current.unitPriceCents) changes.push(said`Unit Price to ${unitPrice === null ? "none" : formatPrice(unitPrice)}`);
        if (fields.description !== current.description) changes.push(["description"]);
      }
      const [updated] = await tx
        .update(item)
        .set({ ...fields, unitPriceCents: unitPrice })
        .where(and(eq(item.id, id), eq(item.kind, kind)))
        .returning({ id: item.id });
      if (!updated) throw new CommandError("invalid", "That item no longer exists.");
      if (asked) {
        const held = await lockItemStock(tx, id);
        if (asked.expectedCount !== undefined && asked.expectedCount !== held.count) {
          throw new CommandError("invalid", "Stock changed while you were editing. Reload and try again.");
        }
        const change = asked.count - held.count;
        if (change !== 0) {
          if (change > 0) await putStock(tx, id, held.locationId, change);
          else await takeStock(tx, id, held.locationId, -change);
          await tx.insert(historyEntry).values({ itemId: id, kind: "adjustment", reason: "recount", count: Math.abs(change),
            [change > 0 ? "toLocationId" : "fromLocationId"]: held.locationId,
            byUserId: actor.userId, happenedOn: museToday,
          });
          changes.push(said`Count to ${asked.count}`);
        }
        if (asked.locationId !== held.locationId) {
          await moveItem(tx, actor, id, held.locationId, asked.locationId, asked.count);
          changes.push(said`Location to ${ref.location(asked.locationId, await locationName(tx, asked.locationId))}`);
        }
      }
      await record("catalog", changes.length ? said`changed ${ref.item(id, current.name, kind)}'s ${listed(changes)}` : null);
      return updated;
    },
  });
}
