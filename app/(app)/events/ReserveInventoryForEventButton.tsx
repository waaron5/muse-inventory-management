"use client";

import { useState } from "react";
import {
  ReserveInventoryModal,
  type ReserveInventoryEventOption,
} from "@/components/ReserveInventoryModal";

interface ReserveInventoryForEventButtonProps {
  event: ReserveInventoryEventOption;
  disabled?: boolean;
}

export function ReserveInventoryForEventButton({
  event,
  disabled = false,
}: ReserveInventoryForEventButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="reserve-inline-button"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Add item +
      </button>

      <ReserveInventoryModal
        open={open}
        onClose={() => setOpen(false)}
        presetEvent={event}
        title={`Reserve inventory for ${event.eventName}`}
      />
    </>
  );
}
