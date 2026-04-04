"use client";

import { useState } from "react";
import {
  ReserveInventoryModal,
  type ReserveInventoryEventOption,
} from "@/components/ReserveInventoryModal";

interface ReserveInventoryForEventButtonProps {
  event: ReserveInventoryEventOption;
  disabled?: boolean;
  reservationState: {
    pendingCount: number;
    approvedCount: number;
  };
}

export function ReserveInventoryForEventButton({
  event,
  disabled = false,
  reservationState,
}: ReserveInventoryForEventButtonProps) {
  const [open, setOpen] = useState(false);
  const hasReservationActivity =
    reservationState.pendingCount > 0 || reservationState.approvedCount > 0;
  const buttonLabel = hasReservationActivity ? "Add More Items" : "Reserve Inventory";

  return (
    <>
      <div className="reserve-inline-stack">
        <button
          type="button"
          className={`reserve-inline-button${
            hasReservationActivity ? " reserve-inline-button-active" : ""
          }`}
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          {buttonLabel}
        </button>
        {hasReservationActivity && (
          <div className="reserve-inline-statuses">
            {reservationState.pendingCount > 0 && (
              <span className="action-status-chip action-status-chip-pending">
                You: {reservationState.pendingCount} pending
              </span>
            )}
            {reservationState.approvedCount > 0 && (
              <span className="action-status-chip action-status-chip-approved">
                You: {reservationState.approvedCount} approved
              </span>
            )}
          </div>
        )}
      </div>

      <ReserveInventoryModal
        open={open}
        onClose={() => setOpen(false)}
        presetEvent={event}
        title={`Reserve inventory for ${event.eventName}`}
      />
    </>
  );
}
