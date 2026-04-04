"use client";

import { useState } from "react";
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
  const hasAvailableEvents = availableEvents.length > 0;

  return (
    <>
      <button
        type="button"
        className="btn btn-dark"
        onClick={() => setOpen(true)}
        disabled={!hasAvailableEvents}
        title={
          hasAvailableEvents
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
