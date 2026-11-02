import { eq } from "drizzle-orm";
import { z } from "zod";
import { location } from "@/db/schema";
import type { Tx } from "@/db/types";
import { CommandError } from "../errors";
import { ref, said } from "./activity";
import { defineCommand } from "./define";

// Anyone can add a Location; Admins rename or delete them.

/** A Location's name as typed. */
export const locationName = z
  .string()
  .trim()
  .min(1, "Give the Location a name.")
  .max(100, "Keep the name under 100 characters.");

const aLocation = z.uuid("That Location no longer exists.");

export const renameLocation = defineCommand({
  name: "renameLocation",
  input: z.object({ locationId: aLocation, name: locationName }),
  allow: ["admin"],
  run: async (tx, _actor, { locationId, name }, record) => {
    const current = await lockLocation(tx, locationId);
    await tx.update(location).set({ name }).where(eq(location.id, locationId));
    await record("stock", name === current.name ? null : said`renamed Location ${current.name} to ${ref.location(locationId, name)}`);
  },
});

/** The Location, locked until the rename saves. */
async function lockLocation(tx: Tx, id: string) {
  const [found] = await tx
    .select({ name: location.name })
    .from(location)
    .where(eq(location.id, id))
    .for("update");
  if (!found) throw new CommandError("invalid", "That Location no longer exists.");
  return found;
}
