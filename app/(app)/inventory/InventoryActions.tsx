"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReserveInventoryModal,
  type ReserveInventoryEventOption,
} from "@/components/ReserveInventoryModal";
import { RowActionsMenu } from "@/components/RowActionsMenu";
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
  bulkSelectionActive,
}: {
  item: Item;
  isAdmin: boolean;
  availableEvents: ReserveInventoryEventOption[];
  reservationState: ReservationState;
  bulkSelectionActive: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const hasReservationActivity =
    reservationState.pendingCount > 0 || reservationState.approvedCount > 0;

  async function handleRetireToggle() {
    if (
      item.status === "ACTIVE" &&
      !confirm(`Retire "${item.title}"? It will no longer be available for new reservations.`)
    )
      return;
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
            aria-label={`Reserve ${item.title}`}
            title={
              bulkSelectionActive
                ? "Clear bulk selection to reserve individual items."
                : `Reserve ${item.title}`
            }
            disabled={bulkSelectionActive}
          >
            <ReserveArrowIcon className="inventory-reserve-icon" />
            Reserve
          </button>
        )}
        {isAdmin && (
          <RowActionsMenu
            triggerLabel={`Actions for ${item.title}`}
            actions={[
              { label: "Edit", href: `/inventory/${item.id}/edit` },
              {
                label: loading ? "…" : item.status === "ACTIVE" ? "Retire" : "Activate",
                onClick: handleRetireToggle,
                variant: item.status === "ACTIVE" ? "danger" : "success",
                disabled: loading,
              },
            ]}
          />
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
