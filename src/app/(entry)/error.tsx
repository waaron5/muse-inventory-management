"use client";

import { ErrorScreen } from "@/components/error-screen";

// Nothing on the sign-in screen reports a bug: nobody is signed in to send it.
export default function EntryError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} report={false} />;
}
