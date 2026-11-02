import { asc, count, eq, sql } from "drizzle-orm";
import { client, event } from "@/db/schema";
import { defineLoader } from "./define";

// One round trip: every Client, Archived ones last, by name, with how many
// Events each has.
export const loadClientsScreen = defineLoader("clients", async (db) => {
  const rows = await db
    .select({
      id: client.id,
      name: client.name,
      colour: client.colour,
      archived: sql<boolean>`${client.archivedAt} is not null`,
      events: count(event.id),
    })
    .from(client)
    .leftJoin(event, eq(event.clientId, client.id))
    .groupBy(client.id)
    .orderBy(asc(sql`${client.archivedAt} is not null`), asc(sql`lower(${client.name})`));
  return { clients: rows };
});
