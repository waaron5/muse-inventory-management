"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import {
  approveInventoryReservation,
  rejectInventoryReservation,
  cancelInventoryReservation,
  returnInventoryReservation,
  createInventoryReservation,
} from "../reservation-actions";
import { StatusBadge } from "@/components/StatusBadge";

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

interface Props {
  itemId: string;
  itemTitle: string;
  isAdmin: boolean;
  userId: string;
  activeReservations: ActiveReservation[];
}

export function InventoryDetailActions({
  itemId,
  itemTitle,
  isAdmin,
  userId,
  activeReservations,
}: Props) {
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

  // Return form state
  const [returnLocation, setReturnLocation] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

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
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(id: string) {
    setLoading(true);
    try {
      await rejectInventoryReservation(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this reservation?")) return;
    setLoading(true);
    try {
      await cancelInventoryReservation(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to cancel");
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
        onClose={() => { setReserveOpen(false); setError(""); }}
        title={`Reserve "${itemTitle}"`}
      >
        <form onSubmit={handleReserve} className="modal-form">
          <div className="form-field">
            <label className="form-label">Event ID</label>
            <input
              type="text"
              className="form-input"
              placeholder="Paste event ID"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              required
            />
            <span className="form-hint">Go to Events page to find event IDs</span>
          </div>
          <div className="form-field">
            <label className="form-label">Quantity</label>
            <input
              type="number"
              className="form-input"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-footer">
            <button type="button" className="btn btn-outline" onClick={() => setReserveOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark" disabled={loading}>
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

      <style jsx>{`
        .action-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .pending-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 16px;
        }
        .pending-title {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin: 0 0 12px;
        }
        .pending-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .pending-card:last-child {
          border-bottom: none;
        }
        .pending-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .pending-event {
          font-size: 13px;
          font-weight: 500;
          color: #111827;
        }
        .pending-meta {
          font-size: 12px;
          color: #6b7280;
        }
        .pending-actions {
          display: flex;
          gap: 6px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.12s, opacity 0.15s;
          white-space: nowrap;
          border: none;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-dark {
          background: #111827;
          color: white;
        }
        .btn-dark:hover:not(:disabled) {
          background: #1f2937;
        }
        .btn-outline {
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
        }
        .btn-outline:hover:not(:disabled) {
          background: #f3f4f6;
        }
        .btn-approve {
          background: #dcfce7;
          color: #166534;
        }
        .btn-approve:hover:not(:disabled) {
          background: #bbf7d0;
        }
        .btn-reject {
          background: #fee2e2;
          color: #991b1b;
        }
        .btn-reject:hover:not(:disabled) {
          background: #fecaca;
        }
        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .form-label {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
        }
        .form-input {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
          resize: vertical;
        }
        .form-input:focus {
          border-color: #00b4d8;
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.1);
        }
        .form-hint {
          font-size: 11px;
          color: #9ca3af;
        }
        .form-error {
          background: #fee2e2;
          border: 1px solid #fca5a5;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          color: #991b1b;
          margin: 0;
        }
        .form-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding-top: 4px;
        }
      `}</style>
    </>
  );
}
