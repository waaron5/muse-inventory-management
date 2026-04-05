"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReserveInventoryModal, type ReserveInventoryEventOption } from "@/components/ReserveInventoryModal";
import { useToast } from "@/components/Toast";
import { retireInventoryItem, activateInventoryItem } from "./actions";

interface Item {
  id: string;
  title: string;
  currentLocation: string | null;
  quantity: number;
  status: "ACTIVE" | "RETIRED";
}

interface ReservationState {
  pendingCount: number;
  approvedCount: number;
}

export function InventoryActions({
  item,
  isAdmin,
  availableEvents,
  reservationState,
}: {
  item: Item;
  isAdmin: boolean;
  availableEvents: ReserveInventoryEventOption[];
  reservationState: ReservationState;
}) {
  const [loading, setLoading] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const hasReservationActivity =
    reservationState.pendingCount > 0 || reservationState.approvedCount > 0;
  const reserveLabel = "Reserve";

  async function handleRetireToggle() {
    if (
      item.status === "ACTIVE" &&
      !confirm(`Retire "${item.title}"? It will no longer be available for new reservations.`)
    ) return;
    setLoading(true);
    try {
      if (item.status === "ACTIVE") {
        await retireInventoryItem(item.id);
        toast(`"${item.title}" retired`);
      } else {
        await activateInventoryItem(item.id);
        toast(`"${item.title}" re-activated`);
      }
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
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
            onClick={() => setReserveOpen(true)}
            aria-label={`${reserveLabel} ${item.title}`}
          >
            <ReserveArrowIcon className="inventory-reserve-icon" />
            {reserveLabel}
          </button>
        )}
        {isAdmin && (
          <div className="inventory-admin-actions">
            <Link
              href={`/inventory/${item.id}/edit`}
              className="event-icon-button"
              aria-label={`Edit ${item.title}`}
              title={`Edit ${item.title}`}
            >
              <EditIcon />
            </Link>
            <button
              type="button"
              className={`event-icon-button${
                item.status === "ACTIVE"
                  ? " event-icon-button-danger"
                  : " event-icon-button-success"
              }`}
              onClick={handleRetireToggle}
              disabled={loading}
              aria-label={
                item.status === "ACTIVE"
                  ? `Retire ${item.title}`
                  : `Activate ${item.title}`
              }
              title={
                item.status === "ACTIVE"
                  ? `Retire ${item.title}`
                  : `Activate ${item.title}`
              }
            >
              {loading ? (
                <span aria-hidden="true">…</span>
              ) : item.status === "ACTIVE" ? (
                <TrashIcon />
              ) : (
                <ActivateIcon />
              )}
            </button>
          </div>
        )}
      </div>

      <ReserveInventoryModal
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
        availableEvents={availableEvents}
        initialSelectedItems={[
          {
            id: item.id,
            title: item.title,
            currentLocation: item.currentLocation,
            totalQuantity: item.quantity,
          },
        ]}
        title={`Reserve "${item.title}"`}
      />
    </>
  );
}

function ReserveArrowIcon({ className }: { className?: string }) {
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

function ActivateIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M229.66,114.34l-96-96a8,8,0,0,0-11.32,0l-96,96A8,8,0,0,0,32,128H72v56a8,8,0,0,0,8,8h96a8,8,0,0,0,8-8V128h40a8,8,0,0,0,5.66-13.66ZM176,112a8,8,0,0,0-8,8v56H88V120a8,8,0,0,0-8-8H51.31L128,35.31,204.69,112Zm8,104a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h96A8,8,0,0,1,184,216Z" />
    </svg>
  );
}
