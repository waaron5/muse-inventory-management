import { and, eq, gt, sql } from "drizzle-orm";
import type { z } from "zod";
import { activity, oauthAccessToken, oauthClient, session, user } from "@/db/schema";
import type { Db, Tx } from "@/db/types";
import type { ActivityArea, ActivityPart } from "@/lib/activity";
import { liveAiToken } from "../auth/ai-tokens";
import { CommandError } from "../errors";
import { timed } from "../timing";

export type Role = "admin" | "user";

/**
 * Who is asking, and from where: a signed-in device, or an AI Connection's
 * access token (ADR 0017). Neither is taken on trust: a command reads both fresh.
 */
export type Actor = { userId: string; sessionId: string } | { userId: string; aiTokenId: string };

/** The actor as the command found them, inside its transaction. */
export type SignedIn = { userId: string; role: Role };

/**
 * Writes the command's one Activity entry: the sentence after the actor's
 * name. Null when it turned out to change nothing, like saving an unchanged form.
 */
export type RecordActivity = (area: ActivityArea, sentence: ActivityPart[] | null) => Promise<void>;

/** The Activity a command recorded; null when it changed nothing. */
export type Recorded = { area: ActivityArea; sentence: ActivityPart[] } | null;

/**
 * Whether an AI Connection can run the command (ADR 0017): `false` keeps it in
 * the app; otherwise it's a tool, described to the AI in Muse's words.
 */
export type AiDecision = false | { description: string };

/**
 * Every change to data is a command (ADR 0003): it validates its input, re-checks
 * the actor in the database, checks their role, then makes the change, its
 * History and its Activity in one transaction. A command must record its
 * Activity exactly once, or it saves nothing; only a change to someone's own
 * profile or disconnecting your own AI Connection, which aren't Muse's data,
 * records none. Each also decides whether an
 * AI Connection may run it, so none reaches the AI without a decision.
 */
export function defineCommand<Input extends z.ZodType, Output>(spec: {
  name: string;
  input: Input;
  allow: readonly Role[];
  ai: AiDecision;
  activity?: false;
  run: (tx: Tx, actor: SignedIn, input: z.output<Input>, record: RecordActivity) => Promise<Output>;
}) {
  /** Runs it, giving back the Activity it recorded too: what an AI is told it changed. */
  const withActivity = (db: Db, actor: Actor, input: z.input<Input>): Promise<{ output: Output; activity: Recorded }> =>
    timed("command", spec.name, async () => {
      const parsed = spec.input.safeParse(input);
      if (!parsed.success) {
        throw new CommandError("invalid", parsed.error.issues[0]?.message ?? "Check what you entered.");
      }
      return db.transaction(async (tx) => {
        const { via, ...signedIn } = await recheck(tx, actor);
        if (!spec.allow.includes(signedIn.role)) {
          throw new CommandError("not-allowed", "Only an Admin can do this.");
        }
        let recorded = 0;
        let written: Recorded = null;
        const record: RecordActivity = async (area, sentence) => {
          recorded += 1;
          if (!sentence) return;
          written = { area, sentence };
          await tx.insert(activity).values({ byUserId: signedIn.userId, area, sentence, ...via });
        };
        const output = await spec.run(tx, signedIn, parsed.data, record);
        const expected = spec.activity === false ? 0 : 1;
        if (recorded !== expected) throw new Error(`${spec.name} recorded its Activity ${recorded} times, not ${expected}.`);
        return { output, activity: written as Recorded };
      });
    });

  const command = (db: Db, actor: Actor, input: z.input<Input>): Promise<Output> =>
    withActivity(db, actor, input).then((done) => done.output);
  return Object.assign(command, { spec, withActivity });
}

/** Any command, as defined. */
export type Command = {
  spec: { name: string; input: z.ZodType; allow: readonly Role[]; ai: AiDecision };
  withActivity: (db: Db, actor: Actor, input: never) => Promise<{ output: unknown; activity: Recorded }>;
};

/** Tells a command from anything else a module exports. */
export function isCommand(value: unknown): value is Command {
  return typeof value === "function" && "spec" in value && "withActivity" in value;
}

type Found = SignedIn & { via?: { viaAiClientId: string; viaAiApp: string } };

// Bypasses the session cookie cache (ADR 0008): someone deactivated or signed
// out a moment ago can change nothing from that moment. An AI Connection's
// token is re-checked the same way, and its change marked with its app.
async function recheck(tx: Tx, actor: Actor): Promise<Found> {
  if ("aiTokenId" in actor) {
    const [found] = await tx
      .select({ role: user.role, clientId: oauthClient.clientId, appName: oauthClient.name })
      .from(oauthAccessToken)
      .innerJoin(user, eq(user.id, oauthAccessToken.userId))
      .innerJoin(oauthClient, eq(oauthClient.clientId, oauthAccessToken.clientId))
      .where(
        and(
          eq(oauthAccessToken.id, actor.aiTokenId),
          eq(oauthAccessToken.userId, actor.userId),
          liveAiToken(),
        ),
      );
    if (!found) throw new CommandError("not-signed-in", "This AI Connection no longer works. Connect again.");
    // An app with no name reads "Done through Aaron's AI app".
    return { userId: actor.userId, role: found.role, via: { viaAiClientId: found.clientId, viaAiApp: found.appName ?? "AI app" } };
  }
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
