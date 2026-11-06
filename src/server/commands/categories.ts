import { eq } from "drizzle-orm";
import { z } from "zod";
import { category } from "@/db/schema";
import type { Tx } from "@/db/types";
import { CommandError } from "../errors";
import { ref, said } from "./activity";
import { defineCommand } from "./define";

const categoryName = z.string().trim().min(1, "Give the Category a name.").max(100, "Keep the name under 100 characters.");
const aCategory = z.uuid("Select a Category that's still in use.");

// Gifts share the catalog commands, but have no Category.
export const categoryIdField = aCategory.optional();

export const createCategory = defineCommand({
  name: "createCategory",
  input: z.object({ name: categoryName }),
  allow: ["admin", "user"],
  ai: {
    description:
      "Adds a Category of Inventory Item. Check the categories tool first: it may already be there.",
  },
  run: async (tx, _actor, input, record) => {
    const [created] = await tx.insert(category).values(input).returning({ id: category.id, name: category.name });
    await record("catalog", said`added Category ${ref.category(created.id, created.name)}`);
    return created;
  },
});

export const renameCategory = defineCommand({
  name: "renameCategory",
  input: z.object({ categoryId: aCategory, name: categoryName }),
  allow: ["admin"],
  ai: {
    description:
      "Renames a Category. Admins only.",
  },
  run: async (tx, _actor, { categoryId, name }, record) => {
    const current = await lockCategory(tx, categoryId);
    await tx.update(category).set({ name }).where(eq(category.id, categoryId));
    await record("catalog", name === current.name ? null : said`renamed Category ${current.name} to ${ref.category(categoryId, name)}`);
  },
});

export const deleteCategory = defineCommand({
  name: "deleteCategory",
  input: z.object({ id: aCategory }),
  allow: ["admin"],
  ai: false,
  run: async (tx, _actor, { id }, record) => {
    const found = await lockCategory(tx, id);
    // The foreign key clears references, including those on Archived items.
    await tx.delete(category).where(eq(category.id, id));
    await record("catalog", said`deleted Category ${ref.category(id, found.name)}`);
  },
});

/** Hold a Category against deletion until the item saves. */
export async function requireCategory(tx: Tx, id: string) {
  const [found] = await tx.select({ id: category.id }).from(category).where(eq(category.id, id)).for("share");
  if (!found) throw new CommandError("invalid", "Select a Category that's still in use.");
}

async function lockCategory(tx: Tx, id: string) {
  const [found] = await tx.select({ name: category.name }).from(category).where(eq(category.id, id)).for("update");
  if (!found) throw new CommandError("invalid", "That Category no longer exists.");
  return found;
}
