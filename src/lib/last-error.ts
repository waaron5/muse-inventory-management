import { digestOf } from "./sentry";

/** An error someone met, as a bug report names it, with its digest or Sentry event. */
export type PageError = { message: string; trackerId?: string };

let last: (PageError & { page?: string }) | undefined;

/** An error as a bug report names it: known by its digest unless Sentry's event is given. */
export function pageErrorOf(error: unknown, trackerId = digestOf(error)): PageError {
  return { message: error instanceof Error ? error.message : String(error), trackerId };
}

/** Keeps the last error on this page, for a bug report to attach. */
export function noteError(error: PageError) {
  last = { ...error, page: globalThis.location?.pathname };
}

/** The last error on this page, if it was met here and not on a page since left. */
export function lastError(): PageError | undefined {
  if (!last || last.page !== globalThis.location?.pathname) return undefined;
  const { message, trackerId } = last;
  return { message, trackerId };
}
