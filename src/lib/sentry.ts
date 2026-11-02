import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Sentry, locked down for privacy (Bug reports, feature requests and error
 * alerts): production only; the error, page URL, browser, app version, and the
 * user's ID and email (set at sign-in) only. No inputs, bodies, cookies,
 * headers, replay or tracing. SDK v11 collects most of these by default, so
 * each is switched off here, and `scrubEvent` strips them again in case an
 * upgrade widens collection.
 */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NEXT_PUBLIC_VERCEL_ENV === "production",
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
    queues: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
  },
  beforeSend: (event: ErrorEvent, hint: EventHint) => (isExpected(hint.originalException) ? null : scrubEvent(event)),
  // Browser-extension noise.
  denyUrls: [/^(chrome|moz|safari(-web)?)-extension:\/\//],
  // Tracing stays off (no tracesSampleRate); this drops any span if it ever
  // turns on. SDK v11 ignores `beforeSendTransaction`, so it can't do this job.
  ignoreSpans: [/.*/],
};

/**
 * An outcome the app expects, which is never an error: a command's refusal
 * (validation, permission denied, signed out), not found, a redirect, a
 * refused sign-in code, or a request aborted or cut off. A Shortage is never
 * thrown, so it never gets this far.
 */
export function isExpected(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (isNavigation(error)) return true;
  // By name: the class itself may come from another bundle.
  if (error.name === "CommandError") return true;
  if (error.name === "APIError") return Number((error as { statusCode?: number }).statusCode) < 500;
  if (error.name === "AbortError") return true;
  return error instanceof TypeError && offline.test(error.message);
}

/** Next's own redirect, not found or forbidden, thrown to unwind a render or an action. */
export function isNavigation(error: unknown) {
  return digestOf(error)?.startsWith("NEXT_") ?? false;
}

/** The digest Next gives a server error: the browser sees it, the server logs and Sentry tag it. */
export function digestOf(error: unknown) {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" ? digest : undefined;
}

// What Chrome, Safari and Firefox throw when a request never reaches the server.
const offline = /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.)$/;

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const { url, method } = event.request;
    event.request = { url: url?.split("?")[0], method };
  }
  if (event.user) {
    const { id, email } = event.user;
    event.user = { id, email };
  }
  delete event.extra;
  delete event.breadcrumbs;
  return event;
}
