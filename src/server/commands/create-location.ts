import { z } from "zod";
import { location } from "@/db/schema";
import { ref, said } from "./activity";
import { defineCommand } from "./define";
import { locationName } from "./locations";

// Anyone can create a Location, wherever one is picked.
export const createLocation = defineCommand({
  name: "createLocation",
  input: z.object({ name: locationName }),
  allow: ["admin", "user"],
  run: async (tx, _actor, input, record) => {
    const [created] = await tx
      .insert(location)
      .values({ name: input.name })
      .returning({ id: location.id, name: location.name });
    await record("stock", said`added Location ${ref.location(created.id, created.name)}`);
    return created;
  },
});
