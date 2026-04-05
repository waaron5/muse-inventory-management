"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "@/components/MetadataIcons";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { InventoryReservationRowActions } from "@/components/InventoryReservationRowActions";
import { InventoryImagePreview } from "@/app/(app)/inventory/InventoryImagePreview";
import { useToast } from "@/components/Toast";
import { getInventoryReservationStatusLabel } from "@/lib/inventory-reservation-ui";
import {
  bulkApproveInventoryReservations,
  bulkReturnInventoryReservations,
} from "@/app/(app)/inventory/reservation-actions";

interface PendingReservation {
  id: string;
  status: string;
  quantity: number;
  requestedById: string;
  inventoryItem: {
    id: string;
    title: string;
    imageUrl: string | null;
    currentLocation: string | null;
  };
  event: {
    id: string;
    eventName: string;
    companyName: string;
    startDate: string;
    endDate: string;
  };
  requestedBy: { id: string; name: string };
}

function formatDateRange(start: string, end: string) {
  return `${new Date(start).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${new Date(end).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function PendingReservationsTable({
  reservations,
  isAdmin,
  userId,
  emptyMessage,
}: {
  reservations: PendingReservation[];
  isAdmin: boolean;
  userId: string;
  emptyMessage: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingAction, setLoadingAction] = useState<
    "approve" | "approveAll" | "return" | null
  >(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnLocation, setReturnLocation] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnError, setReturnError] = useState("");
  const router = useRouter();
  const { toast } = useToast();
  const pendingReservations = reservations.filter(
    (reservation) => reservation.status === "PENDING"
  );
  const returnableReservations = reservations.filter(
    (reservation) =>
      reservation.status === "APPROVED" &&
      (isAdmin || reservation.requestedById === userId)
  );
  const pendingReservationIds = pendingReservations.map((reservation) => reservation.id);
  const returnableReservationIds = returnableReservations.map(
    (reservation) => reservation.id
  );
  const actionableReservationIds = isAdmin
    ? [...pendingReservationIds, ...returnableReservationIds]
    : returnableReservationIds;
  const pendingReservationIdSet = new Set(pendingReservationIds);
  const returnableReservationIdSet = new Set(returnableReservationIds);
  const actionableReservationIdSet = new Set(actionableReservationIds);
  const selectedPendingIds = [...selected].filter((id) => pendingReservationIdSet.has(id));
  const selectedReturnableIds = [...selected].filter((id) =>
    returnableReservationIdSet.has(id)
  );
  const selectedReturnableReservations = reservations.filter((reservation) =>
    selectedReturnableIds.includes(reservation.id)
  );
  const showSelectionColumn = isAdmin || returnableReservationIds.length > 0;
  const columnCount = isAdmin ? 9 : showSelectionColumn ? 8 : 7;
  const busy = loadingAction !== null;

  function closeReturnModal() {
    setReturnOpen(false);
    setReturnLocation("");
    setReturnNotes("");
    setReturnError("");
  }

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(
        [...prev].filter((reservationId) =>
          actionableReservationIdSet.has(reservationId)
        )
      );
      if (next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [reservations, isAdmin, userId]);

  function toggleOne(id: string) {
    if (!actionableReservationIdSet.has(id)) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === actionableReservationIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(actionableReservationIds));
    }
  }

  async function handleBulkApprove() {
    if (selectedPendingIds.length === 0) return;
    setLoadingAction("approve");
    try {
      const results = await bulkApproveInventoryReservations(selectedPendingIds);
      if (results.failed.length === 0) {
        toast(`Approved ${results.approved} reservation${results.approved === 1 ? "" : "s"}`);
      } else {
        toast(
          `Approved ${results.approved}, ${results.failed.length} failed (insufficient availability)`,
          results.approved > 0 ? "success" : "error"
        );
      }
      setSelected(new Set());
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Bulk approve failed", "error");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleApproveAll() {
    if (pendingReservations.length === 0) return;
    if (!confirm(`Approve all ${pendingReservations.length} pending reservation${pendingReservations.length === 1 ? "" : "s"}?`)) return;
    setSelected(new Set(pendingReservationIds));
    setLoadingAction("approveAll");
    try {
      const results = await bulkApproveInventoryReservations(pendingReservationIds);
      if (results.failed.length === 0) {
        toast(`Approved ${results.approved} reservation${results.approved === 1 ? "" : "s"}`);
      } else {
        toast(
          `Approved ${results.approved}, ${results.failed.length} failed (insufficient availability)`,
          results.approved > 0 ? "success" : "error"
        );
      }
      setSelected(new Set());
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Bulk approve failed", "error");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleBulkReturn(event: FormEvent) {
    event.preventDefault();
    if (selectedReturnableIds.length === 0) return;

    setReturnError("");
    setLoadingAction("return");
    try {
      const results = await bulkReturnInventoryReservations(
        selectedReturnableIds,
        returnLocation,
        returnNotes || undefined
      );

      closeReturnModal();
      if (results.failed.length === 0) {
        toast(
          `Returned ${results.returned} reservation${results.returned === 1 ? "" : "s"}`
        );
      } else {
        toast(
          `Returned ${results.returned}, ${results.failed.length} failed`,
          results.returned > 0 ? "success" : "error"
        );
      }
      setSelected(new Set());
      router.refresh();
    } catch (err: unknown) {
      setReturnError(err instanceof Error ? err.message : "Bulk return failed");
    } finally {
      setLoadingAction(null);
    }
  }

  const allSelected =
    actionableReservationIds.length > 0 && selected.size === actionableReservationIds.length;
  const someSelected =
    selected.size > 0 && selected.size < actionableReservationIds.length;

  return (
    <>
      {isAdmin && pendingReservations.length > 1 && (
        <div className="bulk-approve-toolbar">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleApproveAll}
            disabled={busy}
          >
            {loadingAction === "approveAll"
              ? "Approving..."
              : `Approve All (${pendingReservations.length})`}
          </button>
        </div>
      )}

      <div className="table-container">
        <table className="data-table reservations-table">
          <thead>
            <tr>
              {showSelectionColumn && (
                <th className="col-checkbox">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={actionableReservationIds.length === 0}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    aria-label="Select all reservations"
                  />
                </th>
              )}
              <th className="col-image">
                <span className="sr-only">Image</span>
              </th>
              <th>Item</th>
              <th>Event</th>
              <th>Date Range</th>
              <th>Qty</th>
              <th>Status</th>
              {isAdmin && <th>Requested By</th>}
              <th className="reservations-action-header">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="empty-row">
                  {emptyMessage}
                </td>
              </tr>
            )}

            {reservations.map((reservation) => (
              <tr
                key={reservation.id}
                className={`table-row${selected.has(reservation.id) ? " row-selected" : ""}`}
              >
                {showSelectionColumn && (
                  <td className="col-checkbox">
                    {actionableReservationIdSet.has(reservation.id) ? (
                      <input
                        type="checkbox"
                        checked={selected.has(reservation.id)}
                        onChange={() => toggleOne(reservation.id)}
                        aria-label={`Select ${reservation.inventoryItem.title}`}
                      />
                    ) : (
                      <span className="row-selection-placeholder" aria-hidden="true" />
                    )}
                  </td>
                )}
                <td className="col-image">
                  <InventoryImagePreview
                    src={reservation.inventoryItem.imageUrl}
                    alt={reservation.inventoryItem.title}
                  />
                </td>
                <td>
                  <div className="reservation-item-cell">
                    <Link
                      href={`/inventory/${reservation.inventoryItem.id}`}
                      className="item-title-link"
                    >
                      {reservation.inventoryItem.title}
                    </Link>
                    <span className="reservation-item-meta">
                      {reservation.inventoryItem.currentLocation || "No location set"}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="reservation-event-cell">
                    <Link
                      href={`/events/${reservation.event.id}`}
                      className="event-title-link"
                    >
                      {reservation.event.eventName}
                    </Link>
                    <span className="reservation-event-meta">
                      {reservation.event.companyName}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="reservation-date-cell">
                    <span className="table-meta-inline">
                      <CalendarIcon className="table-meta-icon" />
                      <span className="event-meta-text event-date-range">
                        {formatDateRange(
                          reservation.event.startDate,
                          reservation.event.endDate
                        )}
                      </span>
                    </span>
                  </div>
                </td>
                <td>{reservation.quantity}</td>
                <td>
                  <StatusBadge
                    variant={
                      reservation.status.toLowerCase() as Parameters<
                        typeof StatusBadge
                      >[0]["variant"]
                    }
                    label={getInventoryReservationStatusLabel(reservation.status)}
                  />
                </td>
                {isAdmin && (
                  <td className="reservation-requester-cell">
                    {reservation.requestedBy.name}
                  </td>
                )}
                <td className="reservations-action-cell">
                  <InventoryReservationRowActions
                    reservation={{
                      id: reservation.id,
                      status: reservation.status,
                      inventoryItemId: reservation.inventoryItem.id,
                      inventoryItemTitle: reservation.inventoryItem.title,
                      requestedById: reservation.requestedById,
                      eventName: reservation.event.eventName,
                      quantity: reservation.quantity,
                    }}
                    isAdmin={isAdmin}
                    userId={userId}
                    allowRemoveTerminal
                    actionAppearance="reservations-page"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="bulk-approve-bar">
          <span className="bulk-approve-count">{selected.size} selected</span>
          {selectedPendingIds.length > 0 && (
            <button
              type="button"
              className="btn btn-dark btn-sm"
              onClick={handleBulkApprove}
              disabled={busy}
            >
              {loadingAction === "approve"
                ? "Approving..."
                : `Approve Selected (${selectedPendingIds.length})`}
            </button>
          )}
          {selectedReturnableIds.length > 0 && (
            <button
              type="button"
              className="btn btn-dark btn-sm"
              onClick={() => {
                setReturnError("");
                setReturnOpen(true);
              }}
              disabled={busy}
            >
              Return Selected ({selectedReturnableIds.length})
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSelected(new Set())}
            disabled={busy}
          >
            Clear
          </button>
        </div>
      )}

      <Modal
        open={returnOpen}
        onClose={closeReturnModal}
        title={`Return ${selectedReturnableIds.length} ${
          selectedReturnableIds.length === 1 ? "Reservation" : "Reservations"
        }`}
      >
        <form onSubmit={handleBulkReturn} className="modal-form">
          <div className="bulk-return-summary">
            <p className="bulk-return-summary-title">
              One return location will be applied to all selected items.
            </p>
            <div className="bulk-return-list">
              {selectedReturnableReservations.slice(0, 4).map((reservation) => (
                <div key={reservation.id} className="bulk-return-list-item">
                  <span className="bulk-return-list-title">
                    {reservation.inventoryItem.title}
                  </span>
                  <span className="bulk-return-list-meta">
                    {reservation.event.eventName} • {reservation.quantity} item
                    {reservation.quantity === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
              {selectedReturnableReservations.length > 4 && (
                <span className="bulk-return-list-more">
                  +{selectedReturnableReservations.length - 4} more
                </span>
              )}
            </div>
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

          {returnError && <p className="form-error">{returnError}</p>}

          <div className="form-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeReturnModal}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-dark" disabled={busy}>
              {loadingAction === "return" ? "Returning..." : "Confirm Return"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
