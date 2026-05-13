"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { CalendarIcon, LocationPinIcon } from "@/components/MetadataIcons";
import { checkGiftAvailability, createGiftReservation } from "@/app/(app)/gifting/actions";

export interface GiftUseEventOption {
  id: string;
  eventName: string;
  companyName: string;
  location: string;
  startDate: string;
  endDate: string;
}

interface GiftUseModalProps {
  open: boolean;
  onClose: () => void;
  availableEvents: GiftUseEventOption[];
  giftItem: {
    id: string;
    title: string;
    totalQuantity: number;
  };
  title?: string;
}

export function GiftUseModal({
  open,
  onClose,
  availableEvents,
  giftItem,
  title,
}: GiftUseModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState("");

  const selectedEvent = useMemo(
    () => availableEvents.find((event) => event.id === selectedEventId) ?? null,
    [availableEvents, selectedEventId],
  );

  function resetForm() {
    setSelectedEventId("");
    setQuantity("1");
    setNotes("");
    setAvailableQty(null);
    setLoadingAvailability(false);
    setLoadingSubmit(false);
    setError("");
  }

  function closeModal() {
    resetForm();
    onClose();
  }

  useEffect(() => {
    if (!open || !selectedEventId) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingAvailability(true);

    checkGiftAvailability(giftItem.id)
      .then((qty) => {
        if (!cancelled) {
          setAvailableQty(qty);
          setLoadingAvailability(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAvailableQty(null);
          setLoadingAvailability(false);
          setError(err instanceof Error ? err.message : "Unable to check availability.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [giftItem.id, open, selectedEventId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoadingSubmit(true);

    try {
      const result = await createGiftReservation({
        giftItemId: giftItem.id,
        eventId: selectedEventId,
        quantity: parseInt(quantity, 10),
        notes: notes || undefined,
      });
      toast(result.autoApproved ? "Gift request approved" : "Gift request pending approval");
      closeModal();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to save request.");
    } finally {
      setLoadingSubmit(false);
    }
  }

  const requestedQuantity = parseInt(quantity, 10) || 0;
  const exceedsAvailability = availableQty !== null && requestedQuantity > availableQty;

  return (
    <Modal
      open={open}
      onClose={loadingSubmit ? () => {} : closeModal}
      title={title ?? `Use "${giftItem.title}"`}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <div className="form-field">
          <label className="form-label">Event *</label>
          <select
            className="form-input"
            value={selectedEventId}
            onChange={(event) => {
              setSelectedEventId(event.target.value);
              setQuantity("1");
              setAvailableQty(null);
              setError("");
            }}
            required
          >
            <option value="">Select an event…</option>
            {availableEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.eventName} — {event.companyName}
              </option>
            ))}
          </select>
        </div>

        {selectedEvent && (
          <div className="event-info-box">
            <span className="table-meta-inline">
              <LocationPinIcon className="table-meta-icon" />
              <span className="event-info-detail">{selectedEvent.location}</span>
            </span>
            <span className="table-meta-inline">
              <CalendarIcon className="table-meta-icon" />
              <span className="event-info-detail">
                {new Date(selectedEvent.startDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                {" – "}
                {new Date(selectedEvent.endDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </span>
            <span className="event-info-detail">
              {loadingAvailability
                ? "Checking availability…"
                : availableQty !== null
                  ? `Available to use: ${availableQty} of ${giftItem.totalQuantity}`
                  : ""}
            </span>
          </div>
        )}

        <div className="form-field">
          <label className="form-label">Quantity *</label>
          <input
            className="form-input"
            type="number"
            min={1}
            max={availableQty ?? undefined}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
          {exceedsAvailability && (
            <span className="form-error-inline">Only {availableQty} available for this event.</span>
          )}
        </div>

        <div className="form-field">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Any notes about how this item will be used…"
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={loadingSubmit}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-dark"
            disabled={
              loadingSubmit || !selectedEventId || requestedQuantity < 1 || exceedsAvailability
            }
          >
            {loadingSubmit ? "Saving…" : "Request Use"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
