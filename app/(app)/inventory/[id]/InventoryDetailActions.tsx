"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { ReserveInventoryModal } from "@/components/ReserveInventoryModal";
import { useToast } from "@/components/Toast";
import {
  approveInventoryReservation,
  rejectInventoryReservation,
  cancelInventoryReservation,
  returnInventoryReservation,
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
  itemCurrentLocation: string | null;
  itemTotalQuantity: number;
  isAdmin: boolean;
  userId: string;
  activeReservations: ActiveReservation[];
  availableEvents: AvailableEvent[];
}

export function InventoryDetailActions({
  itemId,
  itemTitle,
  itemCurrentLocation,
  itemTotalQuantity,
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

  // Return form state
  const [returnLocation, setReturnLocation] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

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
        subtitle="Pick an event, then reserve this item and add any other inventory needed for the same event."
      />

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
