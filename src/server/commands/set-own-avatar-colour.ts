import { eq } from "drizzle-orm";
import { z } from "zod";
import { user } from "@/db/schema";
import { avatarColourChoices } from "@/lib/avatar-colours";
import { defineCommand } from "./define";

/** A personal colour preference; null restores the person's automatic colour. */
export const setOwnAvatarColour = defineCommand({
  name: "setOwnAvatarColour",
  input: z.object({ colour: z.int().min(0).max(avatarColourChoices.length - 1).nullable() }),
  allow: ["admin", "user"],
  ai: false,
  // Your own profile isn't Muse's data, so it isn't Activity.
  activity: false,
  run: async (tx, actor, { colour }) => {
    await tx.update(user)
      .set({ avatarColourChoice: colour, updatedAt: new Date() })
      .where(eq(user.id, actor.userId));
  },
});
