"use client";

import { useActionState, useEffect } from "react";
import { EntryButton, EntryLink } from "@/components/entry";
import { failsInline, FormError } from "@/components/form";
import { answerAllow } from "./actions";

/**
 * Allow and Cancel. Either way the browser goes back to the AI app, which may
 * live at an address of its own kind (a desktop app's), so it's sent there
 * from here rather than redirected by the action.
 */
export function AllowForm({ request }: { request: string }) {
  const [state, action, pending] = useActionState(failsInline(answerAllow), {});
  const leaving = pending || Boolean(state.returnTo);

  useEffect(() => {
    if (state.returnTo) window.location.assign(state.returnTo);
  }, [state.returnTo]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="request" value={request} />
      <FormError message={state.error} />
      <EntryButton name="intent" value="allow" disabled={leaving}>
        Allow
      </EntryButton>
      <EntryLink type="submit" name="intent" value="cancel" disabled={leaving} className="self-center">
        Cancel
      </EntryLink>
    </form>
  );
}
