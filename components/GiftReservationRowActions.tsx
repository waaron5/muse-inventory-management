"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import {
  approveGiftReservation,
  completeGiftReservation,
  rejectGiftReservation,
} from "@/app/(app)/gifting/actions";
import { useState } from "react";

interface GiftReservationActionRow {
  id: string;
  status: string;
  giftItemId: string;
  requestedById: string;
}

interface GiftReservationRowActionsProps {
  reservation: GiftReservationActionRow;
  isAdmin: boolean;
  fallbackHref?: string;
  fallbackLabel?: string;
}

export function GiftReservationRowActions({
  reservation,
  isAdmin,
  fallbackHref,
  fallbackLabel = "View Event",
}: GiftReservationRowActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loadingAction, setLoadingAction] = useState<
    "approve" | "reject" | "complete" | null
  >(null);
  const canApprove = isAdmin && reservation.status === "PENDING";
  const canComplete = isAdmin && reservation.status === "APPROVED";

  async function handleApprove() {
    setLoadingAction("approve");
    try {
      await approveGiftReservation(reservation.id);
      toast("Gift request approved");
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to approve request", "error");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleReject() {
    if (!window.confirm("Reject this gift request?")) return;

    setLoadingAction("reject");
    try {
      await rejectGiftReservation(reservation.id);
      toast("Gift request rejected");
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to reject request", "error");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleComplete() {
    setLoadingAction("complete");
    try {
      await completeGiftReservation(reservation.id);
      toast("Gift marked as used");
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to mark used", "error");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="row-actions reservation-row-actions">
      {canApprove && (
        <button
          type="button"
          className="btn-action btn-action-primary"
          onClick={handleApprove}
          disabled={loadingAction !== null}
        >
          {loadingAction === "approve" ? "Approving..." : "Approve"}
        </button>
      )}
      {canApprove && (
        <button
          type="button"
          className="btn-action btn-action-danger"
          onClick={handleReject}
          disabled={loadingAction !== null}
        >
          {loadingAction === "reject" ? "Rejecting..." : "Reject"}
        </button>
      )}
      {canComplete && (
        <button
          type="button"
          className="btn-action btn-action-with-icon"
          onClick={handleComplete}
          disabled={loadingAction !== null}
        >
          {loadingAction === "complete" ? "Marking..." : "Mark Used"}
        </button>
      )}
      {!canApprove && !canComplete && fallbackHref && (
        <Link href={fallbackHref} className="btn-action">
          {fallbackLabel}
        </Link>
      )}
    </div>
  );
}
