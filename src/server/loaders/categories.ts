import { and, asc, eq, sql } from "drizzle-orm";
import { category, item } from "@/db/schema";
import { defineLoader } from "./define";

// Count catalog records, including Archived items, rather than physical Stock.
export const loadCategoriesScreen = defineLoader("categories", async (db) => {
  const categories = await db.select({
    id: category.id,
    name: category.name,
    items: sql<number>`count(${item.id})::int`,
  }).from(category)
    .leftJoin(item, and(eq(item.categoryId, category.id), eq(item.kind, "inventory")))
    .groupBy(category.id)
    .orderBy(asc(sql`lower(${category.name})`));
  return { categories };
});
