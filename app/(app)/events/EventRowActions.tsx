"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
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
    <>
      <div className="row-actions">
        <Link href={`/events/${event.id}`} className="btn-action">
          Open
        </Link>
        {isAdmin && (
          <>
            <Link href={`/events/${event.id}/edit`} className="btn-action">
              Edit
            </Link>
            <button
              className="btn-action btn-action-danger"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "…" : "Delete"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
