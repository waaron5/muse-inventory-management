"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import {
  createGiftReservation,
  approveGiftReservation,
  rejectGiftReservation,
  completeGiftReservation,
  checkGiftAvailability,
} from "../actions";

interface PendingReservation {
  id: string;
  quantity: number;
  requestedByName: string;
  eventName: string;
}

interface ApprovedReservation {
  id: string;
  quantity: number;
  requestedByName: string;
  eventName: string;
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
  pendingReservations: PendingReservation[];
  approvedReservations: ApprovedReservation[];
  availableEvents: AvailableEvent[];
}

export function GiftDetailActions({
  itemId,
  itemTitle,
  isAdmin,
  pendingReservations,
  approvedReservations,
  availableEvents,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveEventId, setReserveEventId] = useState("");
  const [reserveQty, setReserveQty] = useState("1");
  const [reserveNotes, setReserveNotes] = useState("");
  const [reserveError, setReserveError] = useState("");
  const [reserveLoading, setReserveLoading] = useState(false);

  // Availability state
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const selectedEvent = availableEvents.find((e) => e.id === reserveEventId);

  // Fetch availability when event selection changes
  useEffect(() => {
    if (!reserveEventId) {
      setAvailableQty(null);
      return;
    }
    let cancelled = false;
    setLoadingAvailability(true);
    checkGiftAvailability(itemId, reserveEventId)
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
  }, [reserveEventId, itemId]);

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();
    setReserveLoading(true);
    setReserveError("");
    try {
      await createGiftReservation({
        giftItemId: itemId,
        eventId: reserveEventId,
        quantity: parseInt(reserveQty, 10),
        notes: reserveNotes || undefined,
      });
      setShowReserveModal(false);
      setReserveEventId("");
      setReserveQty("1");
      setReserveNotes("");
      toast("Gift reservation submitted for approval");
      router.refresh();
    } catch (err: unknown) {
      setReserveError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setReserveLoading(false);
    }
  }

  async function handlePendingAction(type: "approve" | "reject" | "complete", reservationId: string) {
    if (type === "reject" && !confirm("Reject this reservation?")) return;
    setActionLoading(true);
    setActionError("");
    try {
      if (type === "approve") await approveGiftReservation(reservationId);
      else if (type === "reject") await rejectGiftReservation(reservationId);
      else await completeGiftReservation(reservationId);
      const labels = { approve: "Reservation approved", reject: "Reservation rejected", complete: "Gift marked as used" };
      toast(labels[type]);
      router.refresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      <div className="actions-bar">
        <button className="btn btn-primary" onClick={() => setShowReserveModal(true)}>
          Reserve
        </button>
      </div>

      {isAdmin && pendingReservations.length > 0 && (
        <div className="approval-card">
          <h4 className="approval-title">Pending Approvals ({pendingReservations.length})</h4>
          {actionError && <p className="error-msg">{actionError}</p>}
          <div className="approval-list">
            {pendingReservations.map((r) => (
              <div key={r.id} className="approval-row">
                <div className="approval-info">
                  <span className="approval-event">{r.eventName}</span>
                  <span className="approval-meta">Qty: {r.quantity} · By: {r.requestedByName}</span>
                </div>
                <div className="approval-btns">
                  <button
                    className="btn btn-sm btn-success"
                    disabled={actionLoading}
                    onClick={() => handlePendingAction("approve", r.id)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={actionLoading}
                    onClick={() => handlePendingAction("reject", r.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && approvedReservations.length > 0 && (
        <div className="approval-card">
          <h4 className="approval-title">Ready to Complete ({approvedReservations.length})</h4>
          {actionError && <p className="error-msg">{actionError}</p>}
          <div className="approval-list">
            {approvedReservations.map((r) => (
              <div key={r.id} className="approval-row">
                <div className="approval-info">
                  <span className="approval-event">{r.eventName}</span>
                  <span className="approval-meta">Qty: {r.quantity} · By: {r.requestedByName}</span>
                </div>
                <div className="approval-btns">
                  <button
                    className="btn btn-sm btn-outline"
                    disabled={actionLoading}
                    onClick={() => handlePendingAction("complete", r.id)}
                  >
                    Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showReserveModal && (
        <div className="inline-modal-overlay" onClick={() => !reserveLoading && setShowReserveModal(false)}>
          <div className="inline-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="inline-modal-title">Reserve &ldquo;{itemTitle}&rdquo;</h3>
            <form onSubmit={handleReserve} className="modal-form">
              <div className="form-field">
                <label className="form-label">Event <span className="required">*</span></label>
                <select
                  className="form-input"
                  value={reserveEventId}
                  onChange={(e) => { setReserveEventId(e.target.value); setReserveQty("1"); }}
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
                <label className="form-label">Quantity <span className="required">*</span></label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={availableQty ?? undefined}
                  value={reserveQty}
                  onChange={(e) => setReserveQty(e.target.value)}
                  required
                />
                {availableQty !== null && parseInt(reserveQty, 10) > availableQty && (
                  <span className="error-inline">
                    Only {availableQty} available — reduce quantity
                  </span>
                )}
              </div>
              <div className="form-field">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  value={reserveNotes}
                  onChange={(e) => setReserveNotes(e.target.value)}
                  rows={2}
                  maxLength={1000}
                />
              </div>
              {reserveError && <p className="error-msg">{reserveError}</p>}
              <div className="form-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowReserveModal(false)} disabled={reserveLoading}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={reserveLoading || loadingAvailability || (availableQty !== null && parseInt(reserveQty, 10) > availableQty)}
                >
                  {reserveLoading ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
