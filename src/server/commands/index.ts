import "server-only";
import { db } from "@/db";
import type { Db } from "@/db/types";
import { allCommands } from "./all";
import type { Actor } from "./define";
import { giveAwayEnded } from "./give-away";

export type { Actor, Role } from "./define";
export { CommandError } from "../errors";

type Bound<C> = C extends (db: Db, actor: Actor, input: infer Input) => Promise<infer Output>
  ? (actor: Actor, input: Input) => Promise<Output>
  : never;

/** The commands, bound to the app's database. Server Actions call exactly one. */
export const commands = {
  ...(Object.fromEntries(
    Object.entries(allCommands).map(([name, command]) => [name, (actor: Actor, input: never) => command(db, actor, input)]),
  ) as { [Name in keyof typeof allCommands]: Bound<(typeof allCommands)[Name]> }),
  // Run by Vercel Cron, as nobody.
  giveAwayEnded: () => giveAwayEnded(db),
};
