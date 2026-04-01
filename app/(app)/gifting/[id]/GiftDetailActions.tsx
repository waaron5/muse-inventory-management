"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGiftReservation,
  approveGiftReservation,
  rejectGiftReservation,
  completeGiftReservation,
} from "../actions";

interface PendingReservation {
  id: string;
  quantity: number;
  requestedByName: string;
  eventName: string;
}

interface Props {
  itemId: string;
  itemTitle: string;
  isAdmin: boolean;
  userId: string;
  pendingReservations: PendingReservation[];
}

export function GiftDetailActions({ itemId, itemTitle: _, isAdmin, userId: __, pendingReservations }: Props) {
  const router = useRouter();
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveEventId, setReserveEventId] = useState("");
  const [reserveQty, setReserveQty] = useState("1");
  const [reserveNotes, setReserveNotes] = useState("");
  const [reserveError, setReserveError] = useState("");
  const [reserveLoading, setReserveLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

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
      router.refresh();
    } catch (err: unknown) {
      setReserveError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setReserveLoading(false);
    }
  }

  async function handlePendingAction(type: "approve" | "reject" | "complete", reservationId: string) {
    setActionLoading(true);
    setActionError("");
    try {
      if (type === "approve") await approveGiftReservation(reservationId);
      else if (type === "reject") await rejectGiftReservation(reservationId);
      else await completeGiftReservation(reservationId);
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
        <div className="modal-overlay" onClick={() => !reserveLoading && setShowReserveModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Reserve Gift Item</h3>
            <form onSubmit={handleReserve} className="modal-form">
              <div className="field">
                <label className="label">Event ID <span className="required">*</span></label>
                <input
                  className="input"
                  placeholder="Event ID"
                  value={reserveEventId}
                  onChange={(e) => setReserveEventId(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="label">Quantity <span className="required">*</span></label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={reserveQty}
                  onChange={(e) => setReserveQty(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="label">Notes</label>
                <textarea
                  className="input textarea"
                  value={reserveNotes}
                  onChange={(e) => setReserveNotes(e.target.value)}
                  rows={2}
                />
              </div>
              {reserveError && <p className="error-msg">{reserveError}</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowReserveModal(false)} disabled={reserveLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={reserveLoading}>
                  {reserveLoading ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .actions-bar { display: flex; gap: 10px; margin-bottom: 16px; }
        .approval-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 20px;
        }
        .approval-title { font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px; }
        .approval-list { display: flex; flex-direction: column; gap: 10px; }
        .approval-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .approval-info { display: flex; flex-direction: column; gap: 2px; }
        .approval-event { font-size: 13px; font-weight: 500; color: #111827; }
        .approval-meta { font-size: 12px; color: #6b7280; }
        .approval-btns { display: flex; gap: 6px; flex-shrink: 0; }
        .error-msg { color: #dc2626; font-size: 13px; margin: 0 0 10px; }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
        }
        .modal-box {
          background: white;
          border-radius: 12px;
          padding: 28px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .modal-title { font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 20px; }
        .modal-form { display: flex; flex-direction: column; gap: 14px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .label { font-size: 13px; font-weight: 500; color: #374151; }
        .required { color: #dc2626; }
        .input {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
          box-sizing: border-box;
        }
        .input:focus { border-color: #111827; }
        .textarea { resize: vertical; min-height: 60px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
        .btn {
          display: inline-flex;
          align-items: center;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          white-space: nowrap;
          transition: background 0.12s;
        }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-primary { background: #111827; color: white; }
        .btn-primary:hover:not(:disabled) { background: #1f2937; }
        .btn-outline { border: 1px solid #d1d5db; background: white; color: #374151; }
        .btn-outline:hover:not(:disabled) { background: #f3f4f6; }
        .btn-success { background: #d1fae5; color: #065f46; font-size: 12px; padding: 6px 10px; border-radius: 6px; }
        .btn-success:hover:not(:disabled) { background: #a7f3d0; }
        .btn-danger { background: #fee2e2; color: #991b1b; font-size: 12px; padding: 6px 10px; border-radius: 6px; }
        .btn-danger:hover:not(:disabled) { background: #fecaca; }
        .btn-sm { font-size: 12px; padding: 6px 10px; border-radius: 6px; }
      `}</style>
    </>
  );
}
