"use client";

import * as Sentry from "@sentry/nextjs";
import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type PageError, noteError, pageErrorOf } from "@/lib/last-error";
import { digestOf } from "@/lib/sentry";
import { BugReportSheet } from "./bug-report";
import { MainButton, SecondaryButton } from "./button";
import { PageTitle } from "./page-header";
import { PageColumn } from "./page-column";

/**
 * A full-page error: just "Something went wrong.", with Try again, Go back,
 * and Report this, which opens Report a bug with this error attached. Off
 * when nobody can be signed in to send it (sign-in).
 */
export function ErrorScreen({ error, retry, report = true }: { error: unknown; retry: () => void; report?: boolean }) {
  const router = useRouter();
  const met = useRef<PageError>(undefined);
  const [reporting, setReporting] = useState<PageError | false>(false);

  useEffect(() => {
    // A server error reached Sentry there, tagged with its digest; one from
    // the browser is reported here, and known by its event.
    met.current = pageErrorOf(error, digestOf(error) ?? Sentry.captureException(error));
    noteError(met.current);
  }, [error]);

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/events");
  }

  return (
    <PageColumn width="compact" className="flex flex-col gap-6">
      <PageTitle>Something went wrong.</PageTitle>
      <div className="flex flex-wrap gap-3">
        <MainButton icon={RotateCw} onClick={retry}>
          Try again
        </MainButton>
        <SecondaryButton onClick={goBack}>Go back</SecondaryButton>
        {report && <SecondaryButton onClick={() => setReporting(met.current ?? false)}>Report this</SecondaryButton>}
      </div>
      {report && (
        <BugReportSheet
          open={reporting !== false}
          onOpenChange={(open) => !open && setReporting(false)}
          error={reporting || undefined}
        />
      )}
    </PageColumn>
  );
}
