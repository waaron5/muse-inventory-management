import type { ReadDb } from "@/db/types";
import { timed } from "../timing";

/**
 * Reads go through one loader per screen (ADR 0003): a set-based query or two,
 * within the screen's budget of 2 sequential round trips (ADR 0006).
 */
export function defineLoader<Args extends unknown[], Output>(
  name: string,
  load: (db: ReadDb, ...args: Args) => Promise<Output>,
) {
  return (db: ReadDb, ...args: Args): Promise<Output> =>
    timed("loader", name, () => load(db, ...args));
}
