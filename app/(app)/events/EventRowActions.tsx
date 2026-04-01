"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteEvent } from "./actions";

export function EventRowActions({
  event,
  isAdmin,
}: {
  event: { id: string; eventName: string };
  isAdmin: boolean;
}) {
  const router = useRouter();
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
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete event");
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

      <style jsx>{`
        .row-actions {
          display: flex;
          gap: 6px;
        }
        .btn-action {
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          transition: background 0.12s;
          white-space: nowrap;
        }
        .btn-action:hover:not(:disabled) {
          background: #f3f4f6;
        }
        .btn-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-action-danger {
          color: #991b1b;
          border-color: #fca5a5;
        }
        .btn-action-danger:hover:not(:disabled) {
          background: #fee2e2;
        }
      `}</style>
    </>
  );
}
