import { eq } from "drizzle-orm";
import { z } from "zod";
import { user } from "@/db/schema";
import { defineCommand } from "./define";

// Everyone names themselves: at first sign-in, and later in Settings.
export const setOwnName = defineCommand({
  name: "setOwnName",
  input: z.object({
    name: z.string().trim().min(1, "Enter your name.").max(100, "Keep your name under 100 characters."),
  }),
  allow: ["admin", "user"],
  // Your own profile isn't Muse's data, so it isn't Activity.
  activity: false,
  run: async (tx, actor, input) => {
    const [updated] = await tx
      .update(user)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(user.id, actor.userId))
      .returning({ name: user.name });
    return updated;
  },
});
