"use client";

import { EntryCard } from "@/components/entry";
import { ErrorScreen } from "@/components/error-screen";

// Nothing on the sign-in screen reports a bug: nobody is signed in to send it.
// The card is the frame here, so the error's own column drops its border.
export default function EntryError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <EntryCard>
      <ErrorScreen error={error} retry={retry} report={false} className="rail:rounded-none rail:border-0 rail:p-0" />
    </EntryCard>
  );
}
