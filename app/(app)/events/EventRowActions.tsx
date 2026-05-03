"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { deleteEvent } from "./actions";

export function EventRowActions({
  event,
  isAdmin,
}: {
  event: { id: string; eventName: string };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!isAdmin) return null;

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${event.eventName}"? This cannot be undone. Any active reservations must be canceled first.`
      )
    )
      return;

    setLoading(true);
    try {
      await deleteEvent(event.id);
      toast(`"${event.eventName}" deleted`);
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to delete event", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <RowActionsMenu
      triggerLabel={`Actions for ${event.eventName}`}
      actions={[
        { label: "Edit", href: `/events/${event.id}/edit` },
        {
          label: loading ? "Deleting…" : "Delete",
          onClick: handleDelete,
          variant: "danger",
          disabled: loading,
        },
      ]}
    />
  );
}
