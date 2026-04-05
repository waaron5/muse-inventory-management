"use client";

import { useState } from "react";
import { GiftUseModal, type GiftUseEventOption } from "@/components/GiftUseModal";

interface ActiveGiftRequest {
  status: string;
  requestedById: string;
}

interface GiftDetailActionsProps {
  itemId: string;
  itemTitle: string;
  itemTotalQuantity: number;
  userId: string;
  activeReservations: ActiveGiftRequest[];
  availableEvents: GiftUseEventOption[];
}

export function GiftDetailActions({
  itemId,
  itemTitle,
  itemTotalQuantity,
  userId,
  activeReservations,
  availableEvents,
}: GiftDetailActionsProps) {
  const [useOpen, setUseOpen] = useState(false);
  const myPendingRequests = activeReservations.filter(
    (reservation) =>
      reservation.status === "PENDING" && reservation.requestedById === userId
  );
  const myApprovedRequests = activeReservations.filter(
    (reservation) =>
      reservation.status === "APPROVED" && reservation.requestedById === userId
  );
  const hasMyRequestActivity =
    myPendingRequests.length > 0 || myApprovedRequests.length > 0;

  return (
    <>
      <div className="action-bar">
        <button type="button" className="btn btn-dark" onClick={() => setUseOpen(true)}>
          Use this item
        </button>
      </div>
      {hasMyRequestActivity && (
        <div className="action-status-row">
          {myPendingRequests.length > 0 && (
            <span className="action-status-chip action-status-chip-pending">
              {myPendingRequests.length} pending approval
            </span>
          )}
          {myApprovedRequests.length > 0 && (
            <span className="action-status-chip action-status-chip-approved">
              {myApprovedRequests.length} approved
            </span>
          )}
        </div>
      )}

      <GiftUseModal
        open={useOpen}
        onClose={() => setUseOpen(false)}
        availableEvents={availableEvents}
        giftItem={{
          id: itemId,
          title: itemTitle,
          totalQuantity: itemTotalQuantity,
        }}
        title={`Use "${itemTitle}"`}
      />
    </>
  );
}
