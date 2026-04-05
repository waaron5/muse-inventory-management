"use client";

import { useState } from "react";
import { ReserveInventoryModal } from "@/components/ReserveInventoryModal";

interface ActiveReservation {
  status: string;
  requestedById: string;
}

interface AvailableEvent {
  id: string;
  eventName: string;
  companyName: string;
  location: string;
  startDate: string;
  endDate: string;
}

interface Props {
  itemId: string;
  itemTitle: string;
  itemCurrentLocation: string | null;
  itemTotalQuantity: number;
  userId: string;
  activeReservations: ActiveReservation[];
  availableEvents: AvailableEvent[];
}

export function InventoryDetailActions({
  itemId,
  itemTitle,
  itemCurrentLocation,
  itemTotalQuantity,
  userId,
  activeReservations,
  availableEvents,
}: Props) {
  const [reserveOpen, setReserveOpen] = useState(false);
  const myPendingReservations = activeReservations.filter(
    (r) => r.status === "PENDING" && r.requestedById === userId
  );
  const approvedMyReservations = activeReservations.filter(
    (r) => r.status === "APPROVED" && r.requestedById === userId
  );
  const hasMyReservationActivity =
    myPendingReservations.length > 0 || approvedMyReservations.length > 0;

  return (
    <>
      <div className="action-bar">
        <button type="button" className="btn btn-dark" onClick={() => setReserveOpen(true)}>
          Reserve this item
        </button>
      </div>
      {hasMyReservationActivity && (
        <div className="action-status-row">
          {myPendingReservations.length > 0 && (
            <span className="action-status-chip action-status-chip-pending">
              {myPendingReservations.length} pending approval
            </span>
          )}
          {approvedMyReservations.length > 0 && (
            <span className="action-status-chip action-status-chip-approved">
              {approvedMyReservations.length} approved
            </span>
          )}
        </div>
      )}

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
