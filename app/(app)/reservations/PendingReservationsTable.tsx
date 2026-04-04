"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "@/components/MetadataIcons";
import { StatusBadge } from "@/components/StatusBadge";
import { InventoryReservationRowActions } from "@/components/InventoryReservationRowActions";
import { useToast } from "@/components/Toast";
import { getInventoryReservationStatusLabel } from "@/lib/inventory-reservation-ui";
import { bulkApproveInventoryReservations } from "@/app/(app)/inventory/reservation-actions";

interface PendingReservation {
  id: string;
  status: string;
  quantity: number;
  requestedById: string;
  inventoryItem: { id: string; title: string; currentLocation: string | null };
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
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const pendingReservations = reservations.filter(
    (reservation) => reservation.status === "PENDING"
  );
  const pendingReservationIds = pendingReservations.map((reservation) => reservation.id);
  const pendingReservationIdSet = new Set(pendingReservationIds);

  const columnCount = isAdmin ? 8 : 7; // +1 for checkbox column

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(
        [...prev].filter((reservationId) => pendingReservationIdSet.has(reservationId))
      );
      if (next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [reservations]);

  function toggleOne(id: string) {
    if (!pendingReservationIdSet.has(id)) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === pendingReservationIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingReservationIds));
    }
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const results = await bulkApproveInventoryReservations([...selected]);
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
      setLoading(false);
    }
  }

  async function handleApproveAll() {
    if (pendingReservations.length === 0) return;
    if (!confirm(`Approve all ${pendingReservations.length} pending reservation${pendingReservations.length === 1 ? "" : "s"}?`)) return;
    setSelected(new Set(pendingReservationIds));
    setLoading(true);
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
      setLoading(false);
    }
  }

  const allSelected =
    pendingReservationIds.length > 0 && selected.size === pendingReservationIds.length;
  const someSelected =
    selected.size > 0 && selected.size < pendingReservationIds.length;

  return (
    <>
      {isAdmin && pendingReservations.length > 1 && (
        <div className="bulk-approve-toolbar">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleApproveAll}
            disabled={loading}
          >
            Approve All ({pendingReservations.length})
          </button>
        </div>
      )}

      <div className="table-container">
        <table className="data-table reservations-table">
          <thead>
            <tr>
              {isAdmin && (
                <th className="col-checkbox">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={pendingReservationIds.length === 0}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    aria-label="Select all reservations"
                  />
                </th>
              )}
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
                {isAdmin && (
                  <td className="col-checkbox">
                    {reservation.status === "PENDING" ? (
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
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && selected.size > 0 && (
        <div className="bulk-approve-bar">
          <span className="bulk-approve-count">{selected.size} selected</span>
          <button
            type="button"
            className="btn btn-dark btn-sm"
            onClick={handleBulkApprove}
            disabled={loading}
          >
            {loading ? "Approving..." : `Approve Selected (${selected.size})`}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSelected(new Set())}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      )}
    </>
  );
}
