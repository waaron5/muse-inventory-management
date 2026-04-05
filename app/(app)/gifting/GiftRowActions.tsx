"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GiftUseModal, type GiftUseEventOption } from "@/components/GiftUseModal";
import { useToast } from "@/components/Toast";
import { activateGiftItem, consumeGiftItem } from "./actions";

interface GiftItem {
  id: string;
  title: string;
  quantity: number;
  status: "ACTIVE" | "CONSUMED";
}

interface GiftReservationState {
  pendingCount: number;
  approvedCount: number;
}

export function GiftRowActions({
  item,
  isAdmin,
  availableEvents,
  reservationState,
}: {
  item: GiftItem;
  isAdmin: boolean;
  availableEvents: GiftUseEventOption[];
  reservationState: GiftReservationState;
}) {
  const [loading, setLoading] = useState(false);
  const [useOpen, setUseOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const hasReservationActivity =
    reservationState.pendingCount > 0 || reservationState.approvedCount > 0;

  async function handleStatusToggle() {
    if (
      item.status === "ACTIVE" &&
      !confirm(`Mark "${item.title}" as consumed? It will no longer be available for new requests.`)
    ) {
      return;
    }

    setLoading(true);
    try {
      if (item.status === "ACTIVE") {
        await consumeGiftItem(item.id);
        toast(`"${item.title}" marked as consumed`);
      } else {
        await activateGiftItem(item.id);
        toast(`"${item.title}" re-activated`);
      }
      router.refresh();
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : "Action failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="inventory-row-actions">
        {item.status === "ACTIVE" && (
          <button
            type="button"
            className={`inventory-reserve-button${
              hasReservationActivity ? " inventory-reserve-button-active" : ""
            }`}
            onClick={() => setUseOpen(true)}
            aria-label={`Use ${item.title}`}
          >
            <UseArrowIcon className="inventory-reserve-icon" />
            Use
          </button>
        )}
        {isAdmin && (
          <div className="inventory-admin-actions">
            <Link
              href={`/gifting/${item.id}/edit`}
              className="event-icon-button"
              aria-label={`Edit ${item.title}`}
              title={`Edit ${item.title}`}
            >
              <EditIcon />
            </Link>
            <button
              type="button"
              className={`event-icon-button${
                item.status === "ACTIVE" ? " event-icon-button-danger" : ""
              }`}
              onClick={handleStatusToggle}
              disabled={loading}
              aria-label={
                item.status === "ACTIVE"
                  ? `Mark ${item.title} as consumed`
                  : `Activate ${item.title}`
              }
              title={
                item.status === "ACTIVE"
                  ? `Mark ${item.title} as consumed`
                  : `Activate ${item.title}`
              }
            >
              {loading ? <span aria-hidden="true">…</span> : <TrashIcon />}
            </button>
          </div>
        )}
      </div>

      <GiftUseModal
        open={useOpen}
        onClose={() => setUseOpen(false)}
        availableEvents={availableEvents}
        giftItem={{
          id: item.id,
          title: item.title,
          totalQuantity: item.quantity,
        }}
        title={`Use "${item.title}"`}
      />
    </>
  );
}

function UseArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
    </svg>
  );
}

function EditIcon() {
  return (
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
  );
}

function TrashIcon() {
  return (
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
  );
}
