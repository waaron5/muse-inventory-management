"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import {
  approveInventoryReservation,
  rejectInventoryReservation,
  cancelInventoryReservation,
  returnInventoryReservation,
  createInventoryReservation,
  checkInventoryAvailability,
} from "../reservation-actions";

interface ActiveReservation {
  id: string;
  quantity: number;
  status: string;
  requestedById: string;
  requestedByName: string;
  eventName: string;
  eventStartDate: string;
  eventEndDate: string;
  notes?: string;
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
  isAdmin: boolean;
  userId: string;
  activeReservations: ActiveReservation[];
  availableEvents: AvailableEvent[];
}

export function InventoryDetailActions({
  itemId,
  itemTitle,
  isAdmin,
  userId,
  activeReservations,
  availableEvents,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [reserveOpen, setReserveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] =
    useState<ActiveReservation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Reserve form state
  const [eventId, setEventId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  // Availability state
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Return form state
  const [returnLocation, setReturnLocation] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

  const selectedEvent = availableEvents.find((e) => e.id === eventId);

  // Fetch availability when event selection changes
  useEffect(() => {
    if (!eventId) {
      setAvailableQty(null);
      return;
    }
    let cancelled = false;
    setLoadingAvailability(true);
    checkInventoryAvailability(itemId, eventId)
      .then((qty) => {
        if (!cancelled) {
          setAvailableQty(qty);
          setLoadingAvailability(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableQty(null);
          setLoadingAvailability(false);
        }
      });
    return () => { cancelled = true; };
  }, [eventId, itemId]);

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await createInventoryReservation({ inventoryItemId: itemId, eventId, quantity, notes });
      setReserveOpen(false);
      setEventId("");
      setQuantity(1);
      setNotes("");
      toast("Reservation submitted for approval");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create reservation");
    } finally {
      setLoading(false);
    }
  }

  async function handleReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReservation) return;
    setError("");
    setLoading(true);
    try {
      await returnInventoryReservation(selectedReservation.id, returnLocation, returnNotes);
      setReturnOpen(false);
      setSelectedReservation(null);
      setReturnLocation("");
      setReturnNotes("");
      toast("Item returned successfully");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to return");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setLoading(true);
    try {
      await approveInventoryReservation(id);
      toast("Reservation approved");
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to approve", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(id: string) {
    if (!confirm("Reject this reservation?")) return;
    setLoading(true);
    try {
      await rejectInventoryReservation(id);
      toast("Reservation rejected");
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to reject", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this reservation?")) return;
    setLoading(true);
    try {
      await cancelInventoryReservation(id);
      toast("Reservation canceled");
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to cancel", "error");
    } finally {
      setLoading(false);
    }
  }

  const pendingReservations = activeReservations.filter((r) => r.status === "PENDING");
  const approvedMyReservations = activeReservations.filter(
    (r) => r.status === "APPROVED" && r.requestedById === userId
  );

  return (
    <>
      <div className="action-bar">
        <button className="btn btn-dark" onClick={() => setReserveOpen(true)}>
          Reserve
        </button>
        {approvedMyReservations.length > 0 && (
          <button
            className="btn btn-outline"
            onClick={() => {
              setSelectedReservation(approvedMyReservations[0]);
              setReturnOpen(true);
            }}
          >
            Return
          </button>
        )}
      </div>

      {isAdmin && pendingReservations.length > 0 && (
        <div className="pending-section">
          <h4 className="pending-title">Pending Approvals ({pendingReservations.length})</h4>
          {pendingReservations.map((r) => (
            <div key={r.id} className="pending-card">
              <div className="pending-info">
                <span className="pending-event">{r.eventName}</span>
                <span className="pending-meta">
                  Qty: {r.quantity} · {r.requestedByName}
                </span>
              </div>
              <div className="pending-actions">
                <button
                  className="btn btn-approve"
                  onClick={() => handleApprove(r.id)}
                  disabled={loading}
                >
                  Approve
                </button>
                <button
                  className="btn btn-reject"
                  onClick={() => handleReject(r.id)}
                  disabled={loading}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reserve Modal */}
      <Modal
        open={reserveOpen}
        onClose={() => { setReserveOpen(false); setError(""); setAvailableQty(null); }}
        title={`Reserve "${itemTitle}"`}
      >
        <form onSubmit={handleReserve} className="modal-form">
          <div className="form-field">
            <label className="form-label">Event *</label>
            <select
              className="form-input"
              value={eventId}
              onChange={(e) => { setEventId(e.target.value); setQuantity(1); }}
              required
            >
              <option value="">Select an event…</option>
              {availableEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.eventName} — {ev.companyName}
                </option>
              ))}
            </select>
          </div>
          {selectedEvent && (
            <div className="event-info-box">
              <span className="event-info-detail">
                📍 {selectedEvent.location}
              </span>
              <span className="event-info-detail">
                📅 {new Date(selectedEvent.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" – "}
                {new Date(selectedEvent.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <span className="event-info-detail">
                {loadingAvailability
                  ? "Checking availability…"
                  : availableQty !== null
                    ? `${availableQty} unit(s) available for this window`
                    : ""}
              </span>
            </div>
          )}
          <div className="form-field">
            <label className="form-label">Quantity *</label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={availableQty ?? undefined}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
            {availableQty !== null && quantity > availableQty && (
              <span className="form-error-inline">
                Only {availableQty} available — reduce quantity
              </span>
            )}
          </div>
          <div className="form-field">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-footer">
            <button type="button" className="btn btn-outline" onClick={() => setReserveOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-dark"
              disabled={loading || loadingAvailability || (availableQty !== null && quantity > availableQty)}
            >
              {loading ? "Reserving…" : "Submit Reservation"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Return Modal */}
      <Modal
        open={returnOpen}
        onClose={() => { setReturnOpen(false); setError(""); }}
        title={`Return "${itemTitle}"`}
      >
        <form onSubmit={handleReturn} className="modal-form">
          <div className="form-field">
            <label className="form-label">Return Location *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. JP Display warehouse"
              value={returnLocation}
              onChange={(e) => setReturnLocation(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">Notes (optional — damage, issues, etc.)</label>
            <textarea
              className="form-input"
              rows={2}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-footer">
            <button type="button" className="btn btn-outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark" disabled={loading}>
              {loading ? "Returning…" : "Confirm Return"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
