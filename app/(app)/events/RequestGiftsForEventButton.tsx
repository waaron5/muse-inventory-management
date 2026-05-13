"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { CalendarIcon, LocationPinIcon } from "@/components/MetadataIcons";
import { checkGiftAvailability, createGiftReservation } from "@/app/(app)/gifting/actions";
import { formatDateRange } from "@/lib/date-utils";

interface EventOption {
  id: string;
  eventName: string;
  companyName: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface GiftOption {
  id: string;
  title: string;
  totalQuantity: number;
}

interface RequestGiftsForEventButtonProps {
  event: EventOption;
  availableGifts: GiftOption[];
  disabled?: boolean;
}

export function RequestGiftsForEventButton({
  event,
  availableGifts,
  disabled = false,
}: RequestGiftsForEventButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedGiftId, setSelectedGiftId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState("");

  const selectedGift = useMemo(
    () => availableGifts.find((gift) => gift.id === selectedGiftId) ?? null,
    [availableGifts, selectedGiftId],
  );

  function resetForm() {
    setSelectedGiftId("");
    setQuantity("1");
    setNotes("");
    setAvailableQty(null);
    setLoadingAvailability(false);
    setLoadingSubmit(false);
    setError("");
  }

  function closeModal() {
    resetForm();
    setOpen(false);
  }

  useEffect(() => {
    if (!open || !selectedGiftId) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingAvailability(true);
    setError("");

    checkGiftAvailability(selectedGiftId)
      .then((qty) => {
        if (cancelled) return;
        setAvailableQty(qty);
        setLoadingAvailability(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAvailableQty(null);
        setLoadingAvailability(false);
        setError(err instanceof Error ? err.message : "Unable to check availability.");
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedGiftId]);

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setError("");
    setLoadingSubmit(true);

    try {
      const result = await createGiftReservation({
        giftItemId: selectedGiftId,
        eventId: event.id,
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
    <>
      <div className="reserve-inline-stack">
        <button
          type="button"
          className="reserve-inline-button reserve-inline-button-text"
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          <PlusIcon className="reserve-inline-text-icon" />
          Add Gifts
        </button>
      </div>

      <Modal
        open={open}
        onClose={loadingSubmit ? () => {} : closeModal}
        title={`Add gifts to ${event.eventName}`}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="event-info-box">
            {event.location ? (
              <span className="table-meta-inline">
                <LocationPinIcon className="table-meta-icon" />
                <span className="event-info-detail">{event.location}</span>
              </span>
            ) : null}
            {event.startDate || event.endDate ? (
              <span className="table-meta-inline">
                <CalendarIcon className="table-meta-icon" />
                <span className="event-info-detail">
                  {formatDateRange(event.startDate, event.endDate)}
                </span>
              </span>
            ) : null}
          </div>

          <div className="form-field">
            <label className="form-label">Gift *</label>
            <select
              className="form-input"
              value={selectedGiftId}
              onChange={(formEvent) => {
                setSelectedGiftId(formEvent.target.value);
                setQuantity("1");
                setAvailableQty(null);
                setError("");
              }}
              required
            >
              <option value="">Select a gift…</option>
              {availableGifts.map((gift) => (
                <option key={gift.id} value={gift.id}>
                  {gift.title}
                </option>
              ))}
            </select>
          </div>

          {selectedGift && (
            <div className="event-info-box">
              <span className="event-info-detail">
                {loadingAvailability
                  ? "Checking availability…"
                  : availableQty !== null
                    ? `Available to use: ${availableQty} of ${selectedGift.totalQuantity}`
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
              onChange={(formEvent) => setQuantity(formEvent.target.value)}
              required
            />
            {exceedsAvailability && (
              <span className="form-error-inline">
                Only {availableQty} available for this event.
              </span>
            )}
          </div>

          <div className="form-field">
            <label className="form-label">Notes</label>
            <textarea
              className="form-input"
              rows={3}
              value={notes}
              onChange={(formEvent) => setNotes(formEvent.target.value)}
              placeholder="Any notes about how these gifts will be used…"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setOpen(false)}
              disabled={loadingSubmit}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-dark"
              disabled={
                loadingSubmit || !selectedGiftId || requestedQuantity < 1 || exceedsAvailability
              }
            >
              {loadingSubmit ? "Saving…" : "Request Gift"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
    </svg>
  );
}
