import { z } from "zod";
import { endAiConnections } from "../auth/ai-tokens";
import { defineCommand } from "./define";

// Anyone can cut their own AI Connection in Settings (ADR 0017), never anyone
// else's: its next call is refused, and connecting that app again asks for
// Allow again. Other people's connections through the same app stay, since
// everyone's claude.ai is one app.
export const disconnectAiConnection = defineCommand({
  name: "disconnectAiConnection",
  input: z.object({ clientId: z.string().min(1, "That AI Connection is already gone.") }),
  allow: ["admin", "user"],
  ai: false,
  // Your own access, like your own profile, isn't Muse's data (ADR 0013).
  activity: false,
  run: async (tx, actor, { clientId }) => {
    await endAiConnections(tx, actor.userId, clientId);
  },
});
