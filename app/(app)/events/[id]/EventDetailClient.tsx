"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DetailHeaderActions } from "@/components/DetailHeaderActions";
import { DetailTopBar } from "@/components/DetailTopBar";
import { GiftReservationRowActions } from "@/components/GiftReservationRowActions";
import { InventoryReservationRowActions } from "@/components/InventoryReservationRowActions";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import {
  getGiftReservationStatusLabel,
  getGiftReservationStatusVariant,
} from "@/lib/gift-reservation-ui";
import { getInventoryReservationStatusLabel, getInventoryReservationStatusVariant } from "@/lib/inventory-reservation-ui";
import { deleteEvent, updateEvent } from "../actions";
import { ReserveInventoryForEventButton } from "../ReserveInventoryForEventButton";
import type { EventDetailData } from "./detail-data";
import { formatLongDate, formatShortDate, formatAuditDate } from "@/lib/date-utils";

const EVENT_DETAIL_FORM_ID = "event-detail-edit-form";

interface EventDetailClientProps {
  data: EventDetailData;
  isAdmin: boolean;
  userId: string;
  initialEditing?: boolean;
  returnToCanonicalOnExit?: boolean;
}

interface EventDraft {
  eventName: string;
  companyName: string;
  plCode: string;
  location: string;
  startDate: string;
  endDate: string;
  notes: string;
}

function inputDate(value: string) {
  return value.split("T")[0] ?? "";
}

function createDraft(data: EventDetailData): EventDraft {
  return {
    eventName: data.event.eventName,
    companyName: data.event.companyName,
    plCode: data.event.plCode,
    location: data.event.location,
    startDate: inputDate(data.event.startDate),
    endDate: inputDate(data.event.endDate),
    notes: data.event.notes,
  };
}


export function EventDetailClient({
  data,
  isAdmin,
  userId,
  initialEditing = false,
  returnToCanonicalOnExit = false,
}: EventDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const canonicalPath = `/events/${data.event.id}`;
  const [isEditing, setIsEditing] = useState(initialEditing && isAdmin);
  const [draft, setDraft] = useState<EventDraft>(() => createDraft(data));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isEditing) return;
    resetDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.event.updatedAt, isEditing]);

  function resetDraft() {
    setDraft(createDraft(data));
    setError("");
  }

  function updateDraft<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function enterEditMode() {
    resetDraft();
    setIsEditing(true);
  }

  function cancelEdit() {
    resetDraft();
    setIsEditing(false);
    if (returnToCanonicalOnExit) {
      router.replace(canonicalPath);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${data.event.eventName}"? This cannot be undone. Any active reservations must be canceled first.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      await deleteEvent(data.event.id);
      toast(`"${data.event.eventName}" deleted`);
      router.push("/events");
    } catch (deleteError: unknown) {
      toast(
        deleteError instanceof Error ? deleteError.message : "Failed to delete event",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      await updateEvent(data.event.id, {
        companyName: draft.companyName,
        eventName: draft.eventName,
        plCode: draft.plCode,
        location: draft.location,
        startDate: draft.startDate,
        endDate: draft.endDate,
        notes: draft.notes,
      });

      toast("Event updated");
      setIsEditing(false);
      if (returnToCanonicalOnExit) {
        router.replace(canonicalPath);
      } else {
        router.refresh();
      }
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error ? submitError.message : "Something went wrong"
      );
    } finally {
      setSaving(false);
    }
  }

  const headerActions = isAdmin ? (
    <DetailHeaderActions
      title={data.event.eventName}
      isEditing={isEditing}
      formId={EVENT_DETAIL_FORM_ID}
      loading={saving}
      deleting={deleting}
      onEdit={enterEditMode}
      onCancel={cancelEdit}
      onDelete={handleDelete}
    />
  ) : data.event.status === "past" ? undefined : (
    <ReserveInventoryForEventButton
      event={{
        id: data.event.id,
        eventName: data.event.eventName,
        companyName: data.event.companyName,
        location: data.event.location,
        startDate: data.event.startDate,
        endDate: data.event.endDate,
      }}
      reservationState={data.reservationState}
    />
  );

  return (
    <>
      <DetailTopBar
        crumbs={[
          { label: "Events", href: "/events" },
          { label: data.event.eventName },
        ]}
        actions={headerActions}
      />

      <div className="detail-grid-stacked">
        {isEditing ? (
          <form
            id={EVENT_DETAIL_FORM_ID}
            onSubmit={handleSubmit}
            className="detail-edit-form"
          >
            <div className="detail-card">
              <div className="detail-fields detail-edit-fields">
                <div className="detail-row">
                  <span className="detail-label">Status</span>
                  <StatusBadge variant={data.event.status} />
                </div>
                <div className="detail-row">
                  <label className="detail-label" htmlFor="event-name">
                    Event Name
                  </label>
                  <span className="detail-row-control">
                    <input
                      id="event-name"
                      type="text"
                      className="form-input"
                      value={draft.eventName}
                      onChange={(event) =>
                        updateDraft("eventName", event.target.value)
                      }
                      required
                      maxLength={200}
                      disabled={saving}
                    />
                  </span>
                </div>
                <div className="detail-row">
                  <label className="detail-label" htmlFor="event-company">
                    Company
                  </label>
                  <span className="detail-row-control">
                    <input
                      id="event-company"
                      type="text"
                      className="form-input"
                      value={draft.companyName}
                      onChange={(event) =>
                        updateDraft("companyName", event.target.value)
                      }
                      required
                      maxLength={200}
                      disabled={saving}
                    />
                  </span>
                </div>
                <div className="detail-row">
                  <label className="detail-label" htmlFor="event-pl-code">
                    P &amp; L
                  </label>
                  <span className="detail-row-control">
                    <input
                      id="event-pl-code"
                      type="text"
                      className="form-input"
                      value={draft.plCode}
                      onChange={(event) =>
                        updateDraft("plCode", event.target.value)
                      }
                      maxLength={80}
                      disabled={saving}
                    />
                  </span>
                </div>
                <div className="detail-row">
                  <label className="detail-label" htmlFor="event-start-date">
                    Start Date
                  </label>
                  <span className="detail-row-control">
                    <input
                      id="event-start-date"
                      type="date"
                      className="form-input"
                      value={draft.startDate}
                      onChange={(event) =>
                        updateDraft("startDate", event.target.value)
                      }
                      required
                      disabled={saving}
                    />
                  </span>
                </div>
                <div className="detail-row">
                  <label className="detail-label" htmlFor="event-end-date">
                    End Date
                  </label>
                  <span className="detail-row-control">
                    <input
                      id="event-end-date"
                      type="date"
                      className="form-input"
                      value={draft.endDate}
                      onChange={(event) =>
                        updateDraft("endDate", event.target.value)
                      }
                      required
                      min={draft.startDate}
                      disabled={saving}
                    />
                  </span>
                </div>
                <div className="detail-row">
                  <label className="detail-label" htmlFor="event-location">
                    Location
                  </label>
                  <span className="detail-row-control">
                    <input
                      id="event-location"
                      type="text"
                      className="form-input"
                      value={draft.location}
                      onChange={(event) =>
                        updateDraft("location", event.target.value)
                      }
                      required
                      maxLength={200}
                      disabled={saving}
                    />
                  </span>
                </div>
                <div className="detail-row detail-row-block">
                  <label className="detail-label" htmlFor="event-notes">
                    Notes
                  </label>
                  <span className="detail-row-control">
                    <textarea
                      id="event-notes"
                      className="form-input"
                      rows={3}
                      value={draft.notes}
                      onChange={(event) => updateDraft("notes", event.target.value)}
                      maxLength={2000}
                      disabled={saving}
                    />
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Created by</span>
                  <span>{data.event.createdByName ?? "—"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Last Updated</span>
                  <span>
                    {formatAuditDate(data.event.updatedAt)}
                    {data.event.updatedByName && ` by ${data.event.updatedByName}`}
                  </span>
                </div>
                {error && <p className="form-error">{error}</p>}
              </div>
            </div>
          </form>
        ) : (
          <div className="detail-card">
            <div className="detail-fields">
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <StatusBadge variant={data.event.status} />
              </div>
              <div className="detail-row">
                <span className="detail-label">Event Name</span>
                <span>{data.event.eventName}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Company</span>
                <span>{data.event.companyName}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">P &amp; L</span>
                <span>{data.event.plCode || "—"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Date Range</span>
                <span>
                  {formatLongDate(data.event.startDate)}
                  {" – "}
                  {formatLongDate(data.event.endDate)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Location</span>
                <span>{data.event.location}</span>
              </div>
              <div className="detail-row detail-row-block">
                <span className="detail-label">Notes</span>
                <p className="detail-notes">{data.event.notes || "—"}</p>
              </div>
              <div className="detail-row">
                <span className="detail-label">Created by</span>
                <span>{data.event.createdByName ?? "—"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last Updated</span>
                <span>
                  {formatAuditDate(data.event.updatedAt)}
                  {data.event.updatedByName && ` by ${data.event.updatedByName}`}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="reservations-section">
          <h3 className="section-title">
            Inventory Reservations ({data.inventoryReservations.length})
          </h3>
          {data.inventoryReservations.length === 0 ? (
            <p className="empty-hint">None yet.</p>
          ) : (
            <table className="res-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Requested By</th>
                  <th className="res-actions-header">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.inventoryReservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>
                      <Link
                        href={`/inventory/${reservation.inventoryItemId}`}
                        className="item-link"
                      >
                        {reservation.inventoryItemTitle}
                      </Link>
                    </td>
                    <td>{reservation.quantity}</td>
                    <td>
                      <StatusBadge
                        variant={getInventoryReservationStatusVariant(reservation.status)}
                        label={getInventoryReservationStatusLabel(reservation.status)}
                      />
                    </td>
                    <td className="text-muted">{reservation.requestedByName}</td>
                    <td className="res-actions-cell">
                      <InventoryReservationRowActions
                        reservation={{
                          id: reservation.id,
                          status: reservation.status,
                          inventoryItemId: reservation.inventoryItemId,
                          inventoryItemTitle: reservation.inventoryItemTitle,
                          requestedById: reservation.requestedById,
                          eventName: reservation.eventName,
                          quantity: reservation.quantity,
                        }}
                        isAdmin={isAdmin}
                        userId={userId}
                        returnLocationOptions={data.returnLocationOptions}
                        disabled={isEditing}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="reservations-section">
          <h3 className="section-title">
            Gift Reservations ({data.giftReservations.length})
          </h3>
          {data.giftReservations.length === 0 ? (
            <p className="empty-hint">None yet.</p>
          ) : (
            <table className="res-table">
              <thead>
                <tr>
                  <th>Gift</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Requested By</th>
                  {isAdmin && (
                    <th className="res-actions-header">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.giftReservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>
                      <Link
                        href={`/gifting/${reservation.giftItemId}`}
                        className="item-link"
                      >
                        {reservation.giftItemTitle}
                      </Link>
                    </td>
                    <td>{reservation.quantity}</td>
                    <td>
                      <StatusBadge
                        variant={getGiftReservationStatusVariant(
                          reservation.status
                        )}
                        label={getGiftReservationStatusLabel(reservation.status)}
                      />
                    </td>
                    <td className="text-muted">{reservation.requestedByName}</td>
                    {isAdmin && (
                      <td className="res-actions-cell">
                        <GiftReservationRowActions
                          reservation={{
                            id: reservation.id,
                            status: reservation.status,
                            giftItemId: reservation.giftItemId,
                            requestedById: reservation.requestedById,
                          }}
                          isAdmin={isAdmin}
                          disabled={isEditing}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
