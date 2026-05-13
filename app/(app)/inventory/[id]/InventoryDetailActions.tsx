"use client";

import { useState } from "react";
import { ReserveInventoryModal } from "@/components/ReserveInventoryModal";

interface AvailableEvent {
  id: string;
  eventName: string;
  companyName: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface Props {
  itemId: string;
  itemTitle: string;
  itemCurrentLocation: string | null;
  itemTotalQuantity: number;
  availableEvents: AvailableEvent[];
  disabled?: boolean;
}

export function InventoryDetailActions({
  itemId,
  itemTitle,
  itemCurrentLocation,
  itemTotalQuantity,
  availableEvents,
  disabled = false,
}: Props) {
  const [reserveOpen, setReserveOpen] = useState(false);

  return (
    <>
      <div className="action-bar">
        <button
          type="button"
          className="btn btn-dark"
          onClick={() => setReserveOpen(true)}
          disabled={disabled}
        >
          Reserve this item
        </button>
      </div>

      <ReserveInventoryModal
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
        availableEvents={availableEvents}
        initialSelectedItems={[
          {
            id: itemId,
            title: itemTitle,
            currentLocation: itemCurrentLocation,
            totalQuantity: itemTotalQuantity,
          },
        ]}
        title={`Reserve "${itemTitle}"`}
      />
    </>
  );
}
