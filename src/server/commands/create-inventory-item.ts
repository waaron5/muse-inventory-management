import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { historyEntry, item, location, stock } from "@/db/schema";
import { CommandError } from "../errors";
import { museToday } from "../today";
import { ref, said } from "./activity";
import { defineCommand } from "./define";
import { itemFields } from "./item-fields";
import { photoKey, refuseInUse } from "./photos";
import { categoryIdField, requireCategory } from "./categories";
import { ensureUnassigned } from "./stock";
import { UNASSIGNED_LOCATION } from "@/lib/stock";

// Where the item sits when it's added, and how many there are. Left out, it
// sits Unassigned with none.
const startingStock = z
  .object({
    locationId: z.uuid("Pick a Location that's still in use."),
    count: z.int("Enter a whole number.").min(0, "Count can't be less than 0."),
  })
  .optional();

// Admins build the catalog; Inventory Items also require a Category.
export const createInventoryItem = createCatalogItem(
  "inventory",
  "createInventoryItem",
  "Adds an Inventory Item to the catalog: a name and Category (its id from the categories tool), with an optional SKU, Unit Price in dollars (\"24.99\"), Description, and where it's kept and how many (startingStock). Without startingStock it sits Unassigned with none. Its photo is added in the app. Admins only. For a list, call this once for each, then say which went through and which didn't.",
);

/**
 * Adds an Inventory Item or a Gift at its Location, with its Starting Stock
 * entering History; `description` is what an AI is told it does.
 */
export function createCatalogItem(kind: "inventory" | "gift", name: string, description: string) {
  return defineCommand({
    name,
    input: z.object({
      ...itemFields,
      categoryId: categoryIdField,
      startingStock,
      // Its Item Photo, already uploaded.
      photo: photoKey.optional(),
    }).refine((input) => kind === "inventory" ? Boolean(input.categoryId) : input.categoryId === undefined, {
      path: ["categoryId"],
      message: kind === "inventory" ? "Select a Category that's still in use." : "Gifts have no Category.",
    }),
    allow: ["admin"],
    ai: { description },
    run: async (tx, actor, { unitPrice, startingStock, categoryId, ...input }, record) => {
      if (categoryId) await requireCategory(tx, categoryId);
      const at = startingStock ?? { locationId: UNASSIGNED_LOCATION, count: 0 };
      if (startingStock) {
        // Held while this saves, so it isn't deleted under it.
        const [live] = await tx
          .select({ id: location.id })
          .from(location)
          .where(and(eq(location.id, at.locationId), ne(location.id, UNASSIGNED_LOCATION)))
          .for("share");
        if (!live) throw new CommandError("invalid", "Pick a Location that's still in use.");
      } else {
        await ensureUnassigned(tx);
      }
      if (input.photo) await refuseInUse(tx, input.photo);
      const [created] = await tx
        .insert(item)
        .values({ ...input, kind, unitPriceCents: unitPrice, categoryId: categoryId ?? null })
        .returning({ id: item.id });
      await tx.insert(stock).values({ itemId: created.id, ...at });
      if (at.count > 0) {
        await tx.insert(historyEntry).values({
          itemId: created.id,
          kind: "starting-stock",
          count: at.count,
          toLocationId: at.locationId,
          byUserId: actor.userId,
          happenedOn: museToday,
        });
      }
      const count = at.count;
      const added = ref.item(created.id, input.name, kind);
      const catalog = kind === "inventory" ? "Inventory" : "Gifts";
      await record("catalog", count ? said`added ${added} to ${catalog} with ${count}` : said`added ${added} to ${catalog}`);
      return created;
    },
  });
}
