"use client";

import { useState } from "react";
import { useBulkSelectionActive } from "@/components/BulkSelectionContext";
import {
  ReserveInventoryModal,
  type ReserveInventoryEventOption,
} from "@/components/ReserveInventoryModal";

interface NewReservationButtonProps {
  availableEvents: ReserveInventoryEventOption[];
}

export function NewReservationButton({
  availableEvents,
}: NewReservationButtonProps) {
  const [open, setOpen] = useState(false);
  const bulkSelectionActive = useBulkSelectionActive();
  const hasAvailableEvents = availableEvents.length > 0;
  const disabled = !hasAvailableEvents || bulkSelectionActive;

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={
          bulkSelectionActive
            ? "Clear bulk selection before creating a new reservation."
            : hasAvailableEvents
              ? undefined
              : "Create an upcoming event first to reserve inventory."
        }
      >
        + New Reservation
      </button>

      <ReserveInventoryModal
        open={open}
        onClose={() => setOpen(false)}
        availableEvents={availableEvents}
        title="New Reservation"
      />
    </>
  );
}
