import { createHmac } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { signInCount } from "@/db/schema";
import type { Db } from "@/db/types";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Limit = { by: "email" | "ip"; per: number; max: number };

// A code gets 3 tries, but a new code resets them, so these are what actually
// bound guessing: at 20 wrong codes a day, a year of trying one address has
// about a 0.7% chance. They also let anyone who knows an address hold up that
// person's next sign-in, never a session they already have (ADR 0008).
const LIMITS = {
  send: [
    { by: "email", per: MINUTE, max: 1 },
    { by: "email", per: HOUR, max: 5 },
    { by: "ip", per: HOUR, max: 20 },
  ],
  guess: [
    { by: "email", per: HOUR, max: 10 },
    { by: "email", per: DAY, max: 20 },
    { by: "ip", per: HOUR, max: 30 },
  ],
} satisfies Record<string, Limit[]>;

export type SignInAction = keyof typeof LIMITS;

export type SignInLimits = ReturnType<typeof createSignInLimits>;

/**
 * Counts sign-in tries per address and per IP, in the database so every server
 * agrees. Every try counts, invited or not, so a refusal says nothing about who
 * has access. Without an IP, only the address limits apply.
 */
export function createSignInLimits(db: Db, secret: string) {
  return {
    /**
     * Counts this try in one statement, before it happens, so tries made at the
     * same moment can't all slip under a limit. `giveBack` uncounts a try that
     * turned out not to be a wrong guess.
     */
    async take(action: SignInAction, email: string, ip: string | null) {
      const now = Date.now();
      const rows = LIMITS[action].flatMap((limit) => {
        const who = limit.by === "email" ? email : ip;
        if (!who) return [];
        const windowStart = now - (now % limit.per);
        return [
          {
            limit,
            key: keyed(secret, `${action}:${limit.by}:${limit.per}:${who}`),
            windowStart: new Date(windowStart),
            expiresAt: new Date(windowStart + limit.per),
            count: 1,
          },
        ];
      });

      const counted = await db
        .insert(signInCount)
        .values(rows)
        .onConflictDoUpdate({
          target: [signInCount.key, signInCount.windowStart],
          set: { count: sql`${signInCount.count} + 1` },
        })
        .returning({ key: signInCount.key, count: signInCount.count });

      const countOf = new Map(counted.map((row) => [row.key, row.count]));
      const over = rows.filter((row) => countOf.get(row.key)! > row.limit.max);
      for (const { limit, key } of over) {
        // Once per window, and not for someone pressing send twice in a minute.
        if (limit.per > MINUTE && countOf.get(key) === limit.max + 1) {
          Sentry.captureMessage("A sign-in limit was reached", { tags: { action, by: limit.by } });
        }
      }

      return {
        allowed: over.length === 0,
        giveBack: async () => {
          await db
            .update(signInCount)
            .set({ count: sql`${signInCount.count} - 1` })
            .where(or(...rows.map((row) => and(eq(signInCount.key, row.key), eq(signInCount.windowStart, row.windowStart)))));
        },
      };
    },

    /** Clears windows that have ended, so the table stays small. */
    async forgetEnded() {
      await db.delete(signInCount).where(lt(signInCount.expiresAt, new Date()));
    },
  };
}

function keyed(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
