import { asc, eq, ne, sql } from "drizzle-orm";
import { location, stock } from "@/db/schema";
import { defineLoader } from "./define";
import { UNASSIGNED_LOCATION } from "@/lib/stock";

// Every Location by name, with its total Stock, in one round trip.
export const loadLocationsScreen = defineLoader("locations", async (db) => {
  const rows = await db
    .select({
      id: location.id,
      name: location.name,
      holds: sql<number>`coalesce(sum(${stock.count}), 0)::int`,
    })
    .from(location)
    .leftJoin(stock, eq(stock.locationId, location.id))
    .where(ne(location.id, UNASSIGNED_LOCATION))
    .groupBy(location.id)
    .orderBy(asc(sql`lower(${location.name})`));
  return { locations: rows };
});
