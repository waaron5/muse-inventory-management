"use client";

import { useState } from "react";
import {
  ReserveInventoryModal,
  type ReserveInventoryEventOption,
} from "@/components/ReserveInventoryModal";

interface ReserveInventoryForEventButtonProps {
  event: ReserveInventoryEventOption;
  disabled?: boolean;
  variant?: "default" | "text";
  reservationState: {
    pendingCount: number;
    approvedCount: number;
  };
}

export function ReserveInventoryForEventButton({
  event,
  disabled = false,
  variant = "default",
  reservationState,
}: ReserveInventoryForEventButtonProps) {
  const [open, setOpen] = useState(false);
  const hasReservationActivity =
    reservationState.pendingCount > 0 || reservationState.approvedCount > 0;
  const buttonLabel =
    variant === "text"
      ? "Add Items"
      : hasReservationActivity
        ? "Add More Items"
        : "Reserve Inventory";

  return (
    <>
      <div className="reserve-inline-stack">
        <button
          type="button"
          className={`reserve-inline-button${
            variant === "text" ? " reserve-inline-button-text" : ""
          }${
            hasReservationActivity && variant !== "text"
              ? " reserve-inline-button-active"
              : ""
          }`}
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          {variant === "text" && <PlusIcon className="reserve-inline-text-icon" />}
          {buttonLabel}
        </button>
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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
    </svg>
  );
}
