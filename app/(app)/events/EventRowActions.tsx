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
    <div className="event-row-actions">
      <Link
        href={`/events/${event.id}/edit`}
        className="event-icon-button"
        aria-label={`Edit ${event.eventName}`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </Link>
      <button
        type="button"
        className="event-icon-button event-icon-button-danger"
        onClick={handleDelete}
        disabled={loading}
        aria-label={`Delete ${event.eventName}`}
      >
        {loading ? (
          <span aria-hidden="true">…</span>
        ) : (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        )}
      </button>
    </div>
  );
}
