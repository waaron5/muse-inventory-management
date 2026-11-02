import { currentSession } from "@/server/auth";
import { AccountMenu } from "./account-menu";
import { loaders } from "@/server/loaders";

/** The signed-in person, streamed into the prerendered shell. */
export async function Account({ compact }: { compact?: boolean }) {
  const session = await currentSession();
  if (!session) return null;
  const avatarColour = await loaders.avatarColour(session.user.id);
  return <AccountMenu user={{ ...session.user, avatarColour }} compact={compact} />;
}
