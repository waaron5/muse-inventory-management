import { and, eq, gt, sql } from "drizzle-orm";
import type { z } from "zod";
import { activity, session, user } from "@/db/schema";
import type { Db, Tx } from "@/db/types";
import type { ActivityArea, ActivityPart } from "@/lib/activity";
import { CommandError } from "../errors";
import { timed } from "../timing";

export type Role = "admin" | "user";

/**
 * Who is asking, and from which signed-in device. Neither is taken on trust:
 * a command reads both fresh.
 */
export type Actor = { userId: string; sessionId: string };

/** The actor as the command found them, inside its transaction. */
export type SignedIn = { userId: string; role: Role };

/**
 * Writes the command's one Activity entry: the sentence after the actor's
 * name. Null when it turned out to change nothing, like saving an unchanged form.
 */
export type RecordActivity = (area: ActivityArea, sentence: ActivityPart[] | null) => Promise<void>;

/**
 * Every change to data is a command (ADR 0003): it validates its input, re-checks
 * the actor in the database, checks their role, then makes the change, its
 * History and its Activity in one transaction. A command must record its
 * Activity exactly once, or it saves nothing; only a change to someone's own
 * profile, which isn't Muse's data, records none.
 */
export function defineCommand<Input extends z.ZodType, Output>(spec: {
  name: string;
  input: Input;
  allow: readonly Role[];
  activity?: false;
  run: (tx: Tx, actor: SignedIn, input: z.output<Input>, record: RecordActivity) => Promise<Output>;
}) {
  return (db: Db, actor: Actor, input: z.input<Input>): Promise<Output> =>
    timed("command", spec.name, async () => {
      const parsed = spec.input.safeParse(input);
      if (!parsed.success) {
        throw new CommandError("invalid", parsed.error.issues[0]?.message ?? "Check what you entered.");
      }
      return db.transaction(async (tx) => {
        const signedIn = await recheck(tx, actor);
        if (!spec.allow.includes(signedIn.role)) {
          throw new CommandError("not-allowed", "Only an Admin can do this.");
        }
        let recorded = 0;
        const record: RecordActivity = async (area, sentence) => {
          recorded += 1;
          if (sentence) await tx.insert(activity).values({ byUserId: signedIn.userId, area, sentence });
        };
        const output = await spec.run(tx, signedIn, parsed.data, record);
        const expected = spec.activity === false ? 0 : 1;
        if (recorded !== expected) throw new Error(`${spec.name} recorded its Activity ${recorded} times, not ${expected}.`);
        return output;
      });
    });
}

// Bypasses the session cookie cache (ADR 0008): someone deactivated or signed
// out a moment ago can change nothing from that moment.
async function recheck(tx: Tx, actor: Actor): Promise<SignedIn> {
  const [found] = await tx
    .select({ role: user.role, banned: user.banned })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(
      and(
        eq(session.id, actor.sessionId),
        eq(session.userId, actor.userId),
        gt(session.expiresAt, sql`now()`),
      ),
    );
  if (!found || found.banned) {
    throw new CommandError("not-signed-in", "Sign in again to continue.");
  }
  return { userId: actor.userId, role: found.role };
}
