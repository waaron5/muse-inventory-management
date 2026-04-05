"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import {
  approveInventoryReservation,
  rejectInventoryReservation,
  cancelInventoryReservation,
  returnInventoryReservation,
  editInventoryReservation,
  removeInventoryReservationHistory,
} from "@/app/(app)/inventory/reservation-actions";

interface InventoryReservationActionRow {
  id: string;
  status: string;
  inventoryItemId: string;
  inventoryItemTitle: string;
  requestedById: string;
  eventName: string;
  quantity: number;
}

interface InventoryReservationRowActionsProps {
  reservation: InventoryReservationActionRow;
  isAdmin: boolean;
  userId: string;
  fallbackHref?: string;
  fallbackLabel?: string;
  allowRemoveTerminal?: boolean;
  actionAppearance?: "default" | "reservations-page";
}

export function InventoryReservationRowActions({
  reservation,
  isAdmin,
  userId,
  fallbackHref,
  fallbackLabel = "View Item",
  allowRemoveTerminal = false,
  actionAppearance = "default",
}: InventoryReservationRowActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnLocation, setReturnLocation] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editQuantity, setEditQuantity] = useState(String(reservation.quantity));
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState<
    "approve" | "reject" | "cancel" | "return" | "edit" | "remove" | null
  >(null);

  const canApprove = isAdmin && reservation.status === "PENDING";
  const canCancel =
    reservation.status === "PENDING" && reservation.requestedById === userId;
  const canEdit =
    reservation.status === "PENDING" && reservation.requestedById === userId;
  const canReturn =
    reservation.status === "APPROVED" &&
    (reservation.requestedById === userId || isAdmin);
  const canRemoveTerminal =
    allowRemoveTerminal &&
    ["REJECTED", "COMPLETED"].includes(reservation.status) &&
    (reservation.requestedById === userId || isAdmin);
  const useReservationsPageAppearance =
    actionAppearance === "reservations-page";
  const resolvedFallbackHref =
    fallbackHref ?? `/inventory/${reservation.inventoryItemId}`;

  function closeReturnModal() {
    setReturnOpen(false);
    setReturnLocation("");
    setReturnNotes("");
    setError("");
  }

  function closeEditModal() {
    setEditOpen(false);
    setEditQuantity(String(reservation.quantity));
    setError("");
  }

  async function handleEdit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const qty = parseInt(editQuantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Quantity must be at least 1");
      return;
    }
    setLoadingAction("edit");
    try {
      await editInventoryReservation(reservation.id, { quantity: qty });
      closeEditModal();
      toast(`Reservation updated to ${qty} unit${qty === 1 ? "" : "s"}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update reservation");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleApprove() {
    setLoadingAction("approve");
    try {
      await approveInventoryReservation(reservation.id);
      toast("Reservation approved");
      router.refresh();
    } catch (err: unknown) {
      toast(
        err instanceof Error ? err.message : "Failed to approve reservation",
        "error"
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleReject() {
    if (!window.confirm("Reject this reservation?")) return;

    setLoadingAction("reject");
    try {
      await rejectInventoryReservation(reservation.id);
      toast("Reservation rejected");
      router.refresh();
    } catch (err: unknown) {
      toast(
        err instanceof Error ? err.message : "Failed to reject reservation",
        "error"
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this reservation request?")) return;

    setLoadingAction("remove");
    try {
      await cancelInventoryReservation(reservation.id);
      toast("Reservation canceled");
      router.refresh();
    } catch (err: unknown) {
      toast(
        err instanceof Error ? err.message : "Failed to cancel reservation",
        "error"
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleReturn(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoadingAction("return");

    try {
      await returnInventoryReservation(
        reservation.id,
        returnLocation,
        returnNotes || undefined
      );
      closeReturnModal();
      toast("Item returned");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to return item");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRemoveTerminal() {
    const label =
      reservation.status === "COMPLETED" ? "returned" : "rejected";

    if (!window.confirm(`Remove this ${label} reservation from the list?`)) {
      return;
    }

    setLoadingAction("remove");
    try {
      await removeInventoryReservationHistory(reservation.id);
      toast("Reservation removed");
      router.refresh();
    } catch (err: unknown) {
      toast(
        err instanceof Error ? err.message : "Failed to remove reservation",
        "error"
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <>
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
        {canEdit && (
          <button
            type="button"
            className="btn-action btn-action-icon"
            onClick={() => {
              setError("");
              setEditQuantity(String(reservation.quantity));
              setEditOpen(true);
            }}
            disabled={loadingAction !== null}
            aria-label="Edit reservation"
            title="Edit reservation"
          >
            <EditIcon />
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            className="btn-action btn-action-danger"
            onClick={handleCancel}
            disabled={loadingAction !== null}
          >
            {loadingAction === "cancel" ? "Canceling..." : "Cancel Request"}
          </button>
        )}
        {canReturn && (
          <button
            type="button"
            className={`btn-action btn-action-with-icon${
              useReservationsPageAppearance
                ? " inventory-reserve-button reservation-table-action-button"
                : ""
            }`}
            onClick={() => {
              setError("");
              setReturnOpen(true);
            }}
            disabled={loadingAction !== null}
          >
            <ReturnIcon className="btn-action-inline-icon" />
            Return Item
          </button>
        )}
        {canRemoveTerminal && (
          <button
            type="button"
            className={`btn-action btn-action-with-icon${
              useReservationsPageAppearance
                ? " inventory-reserve-button reservation-table-action-button reservation-table-action-button-muted"
                : ""
            }`}
            onClick={handleRemoveTerminal}
            disabled={loadingAction !== null}
          >
            <RemoveCircleIcon className="btn-action-inline-icon" />
            {loadingAction === "remove" ? "Removing..." : "Remove"}
          </button>
        )}
        {!canApprove &&
          !canCancel &&
          !canReturn &&
          !canRemoveTerminal &&
          resolvedFallbackHref && (
          <Link href={resolvedFallbackHref} className="btn-action">
            {fallbackLabel}
          </Link>
        )}
      </div>

      <Modal
        open={returnOpen}
        onClose={closeReturnModal}
        title={`Return "${reservation.inventoryItemTitle}"`}
      >
        <form onSubmit={handleReturn} className="modal-form">
          <div className="reservation-return-summary">
            <span className="event-name-inline">{reservation.eventName}</span>
            <span>{reservation.quantity} item(s) ready to return</span>
          </div>

          <div className="form-field">
            <label className="form-label">Return Location *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. JP Display warehouse"
              value={returnLocation}
              onChange={(event) => setReturnLocation(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-input"
              rows={2}
              value={returnNotes}
              onChange={(event) => setReturnNotes(event.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeReturnModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-dark"
              disabled={loadingAction !== null}
            >
              {loadingAction === "return" ? "Returning..." : "Confirm Return"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={closeEditModal}
        title={`Edit Reservation`}
      >
        <form onSubmit={handleEdit} className="modal-form">
          <div className="reservation-return-summary">
            <strong>{reservation.inventoryItemTitle}</strong>
            <span>{reservation.eventName}</span>
          </div>

          <div className="form-field">
            <label className="form-label">Quantity</label>
            <input
              type="number"
              className="form-input"
              min={1}
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeEditModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-dark"
              disabled={loadingAction !== null}
            >
              {loadingAction === "edit" ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function EditIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function RemoveCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M176,128a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,128Zm56,0A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" />
    </svg>
  );
}

function ReturnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M189.66,122.34a8,8,0,0,1,0,11.32l-72,72a8,8,0,0,1-11.32-11.32L164.69,136H32a8,8,0,0,1,0-16H164.69L106.34,61.66a8,8,0,0,1,11.32-11.32ZM216,32a8,8,0,0,0-8,8V216a8,8,0,0,0,16,0V40A8,8,0,0,0,216,32Z" />
    </svg>
  );
}
