import * as Sentry from "@sentry/nextjs";
import { digestOf, sentryOptions } from "@/lib/sentry";

export function register() {
  Sentry.init(sentryOptions);
}

// Tagged with the digest the error page holds, so the tracker ID a bug report
// carries finds the server's own event (search `digest:<ID>` in Sentry).
export const onRequestError: typeof Sentry.captureRequestError = (error, request, context) => {
  Sentry.withScope((scope) => {
    const digest = digestOf(error);
    if (digest) scope.setTag("digest", digest);
    Sentry.captureRequestError(error, request, context);
  });
};
