import type { Actor } from "../commands/define";
import type { Auth } from "./create-auth";

/**
 * The signed-in person on this request, or null. Trusts the signed cookie cache
 * for up to 5 minutes (ADR 0008), so this is for showing things; a command
 * re-checks `actor` against the database itself.
 */
export async function readSession(auth: Auth, requestHeaders: Headers) {
  const found = await auth.api.getSession({ headers: requestHeaders });
  if (!found || found.user.banned) return null;
  const { user, session } = found;
  const actor: Actor = { userId: user.id, sessionId: session.id };
  return {
    actor,
    user: { id: user.id, name: user.name, email: user.email, avatarColour: user.avatarColour, role: user.role === "admin" ? "admin" : "user" } as const,
  };
}
