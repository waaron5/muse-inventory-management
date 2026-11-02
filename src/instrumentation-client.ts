import * as Sentry from "@sentry/nextjs";
import { noteError } from "@/lib/last-error";
import { sentryOptions } from "@/lib/sentry";

Sentry.init(sentryOptions);

// An error Sentry kept, not one it dropped as expected, is the page's last,
// for a bug report to attach.
Sentry.getClient()?.on("afterSendEvent", (event) => {
  const thrown = event.exception?.values?.at(-1);
  if (thrown && event.event_id) noteError({ message: thrown.value ?? thrown.type ?? "Error", trackerId: event.event_id });
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
