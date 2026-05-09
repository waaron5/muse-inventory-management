"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DetailHeaderActions } from "@/components/DetailHeaderActions";
import { DetailTopBar } from "@/components/DetailTopBar";
import { InlineItemImageField } from "@/components/InlineItemImageField";
import { InventoryReservationRowActions } from "@/components/InventoryReservationRowActions";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { getInventoryReservationStatusLabel } from "@/lib/inventory-reservation-ui";
import { uploadManagedItemImage } from "@/lib/item-image-client";
import { formatShortDate, formatAuditDate } from "@/lib/date-utils";
import { activateInventoryItem, retireInventoryItem, updateInventoryItem } from "../actions";
import { InventoryDetailActions } from "./InventoryDetailActions";
import type { InventoryDetailData } from "./detail-data";

const INVENTORY_DETAIL_FORM_ID = "inventory-detail-edit-form";

interface InventoryDetailClientProps {
  data: InventoryDetailData;
  isAdmin: boolean;
  userId: string;
  initialEditing?: boolean;
  returnToCanonicalOnExit?: boolean;
}

interface InventoryDraft {
  title: string;
  description: string;
  quantity: string;
  currentLocation: string;
  notes: string;
}

function createDraft(data: InventoryDetailData): InventoryDraft {
  const currentLocation =
    data.item.currentLocation &&
    (data.returnLocationOptions as readonly string[]).includes(data.item.currentLocation)
      ? data.item.currentLocation
      : "";

  return {
    title: data.item.title,
    description: data.item.description,
    quantity: String(data.item.quantity),
    currentLocation,
    notes: data.item.notes,
  };
}

export function InventoryDetailClient({
  data,
  isAdmin,
  userId,
  initialEditing = false,
  returnToCanonicalOnExit = false,
}: InventoryDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const canonicalPath = `/inventory/${data.item.id}`;
  const [isEditing, setIsEditing] = useState(initialEditing && isAdmin);
  const [draft, setDraft] = useState<InventoryDraft>(() => createDraft(data));
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const existingImageUrl = data.item.imageUrl.trim() || null;
  const displayedImageUrl =
    selectedImagePreviewUrl ?? (removeExistingImage ? null : existingImageUrl);

  useEffect(() => {
    if (!selectedImageFile) {
      setSelectedImagePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImageFile);
    setSelectedImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImageFile]);

  useEffect(() => {
    if (isEditing) return;
    resetDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.item.updatedAt, isEditing]);

  function resetDraft() {
    setDraft(createDraft(data));
    setSelectedImageFile(null);
    setSelectedImagePreviewUrl(null);
    setRemoveExistingImage(false);
    setError("");
    setImageError("");
  }

  function updateDraft<K extends keyof InventoryDraft>(key: K, value: InventoryDraft[K]) {
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
        `Delete "${data.item.title}"? It will be retired and moved to the bottom of inventory.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      await retireInventoryItem(data.item.id);
      toast("Item deleted", "success", {
        duration: 10000,
        actionLabel: "Undo",
        onAction: async () => {
          await activateInventoryItem(data.item.id);
          router.refresh();
          toast("Item restored");
        },
      });
      router.push("/inventory");
    } catch (deleteError: unknown) {
      toast(deleteError instanceof Error ? deleteError.message : "Failed to delete item", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setImageError("");

    const quantity = Number(draft.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setError("Quantity must be zero or greater");
      return;
    }

    setSaving(true);
    try {
      let imageUrl: string | null = removeExistingImage ? null : existingImageUrl;

      if (selectedImageFile) {
        imageUrl = await uploadManagedItemImage(selectedImageFile);
      }

      await updateInventoryItem(data.item.id, {
        title: draft.title,
        description: draft.description || undefined,
        imageUrl,
        quantity,
        currentLocation: draft.currentLocation,
        notes: draft.notes || undefined,
      });

      toast("Item updated");
      setIsEditing(false);
      if (returnToCanonicalOnExit) {
        router.replace(canonicalPath);
      } else {
        router.refresh();
      }
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const headerActions = isAdmin ? (
    <DetailHeaderActions
      title={data.item.title}
      isEditing={isEditing}
      formId={INVENTORY_DETAIL_FORM_ID}
      loading={saving}
      deleting={deleting}
      onEdit={enterEditMode}
      onCancel={cancelEdit}
      onDelete={handleDelete}
    />
  ) : undefined;

  return (
    <>
      <DetailTopBar
        crumbs={[{ label: "Inventory", href: "/inventory" }, { label: data.item.title }]}
        actions={headerActions}
      />

      <div className="detail-grid">
        <div className="detail-main">
          {isEditing ? (
            <form
              id={INVENTORY_DETAIL_FORM_ID}
              onSubmit={handleSubmit}
              className="detail-edit-form"
            >
              <div className="detail-card detail-card-with-media">
                <div className="detail-image-section">
                  <InlineItemImageField
                    displayedImageUrl={displayedImageUrl}
                    selectedImageFile={selectedImageFile}
                    imageError={imageError}
                    disabled={saving}
                    onFileSelected={(file) => {
                      setSelectedImageFile(file);
                      setRemoveExistingImage(false);
                    }}
                    onClear={() => {
                      setImageError("");
                      if (selectedImageFile) {
                        setSelectedImageFile(null);
                        return;
                      }
                      setRemoveExistingImage(true);
                    }}
                    onError={setImageError}
                  />
                </div>

                <div className="detail-fields detail-edit-fields">
                  <div className="detail-row">
                    <span className="detail-label">Status</span>
                    <StatusBadge variant={data.item.status === "ACTIVE" ? "active" : "retired"} />
                  </div>
                  <div className="detail-row">
                    <label className="detail-label" htmlFor="inventory-title">
                      Item Name
                    </label>
                    <span className="detail-row-control">
                      <input
                        id="inventory-title"
                        type="text"
                        className="form-input"
                        value={draft.title}
                        onChange={(event) => updateDraft("title", event.target.value)}
                        required
                        maxLength={200}
                        disabled={saving}
                      />
                    </span>
                  </div>
                  <div className="detail-row">
                    <label className="detail-label" htmlFor="inventory-description">
                      Description
                    </label>
                    <span className="detail-row-control">
                      <input
                        id="inventory-description"
                        type="text"
                        className="form-input"
                        value={draft.description}
                        onChange={(event) => updateDraft("description", event.target.value)}
                        maxLength={500}
                        disabled={saving}
                      />
                    </span>
                  </div>
                  <div className="detail-row">
                    <label className="detail-label" htmlFor="inventory-quantity">
                      Total Quantity
                    </label>
                    <span className="detail-row-control">
                      <input
                        id="inventory-quantity"
                        type="number"
                        className="form-input"
                        min={0}
                        value={draft.quantity}
                        onChange={(event) => updateDraft("quantity", event.target.value)}
                        required
                        disabled={saving}
                      />
                    </span>
                  </div>
                  <div className="detail-row">
                    <label className="detail-label" htmlFor="inventory-location">
                      Location
                    </label>
                    <span className="detail-row-control">
                      <select
                        id="inventory-location"
                        className="form-input"
                        value={draft.currentLocation}
                        onChange={(event) => updateDraft("currentLocation", event.target.value)}
                        required
                        disabled={saving}
                      >
                        <option value="">Select a location</option>
                        {data.returnLocationOptions.map((location) => (
                          <option key={location} value={location}>
                            {location}
                          </option>
                        ))}
                      </select>
                      {data.item.currentLocation &&
                        !(data.returnLocationOptions as readonly string[]).includes(
                          data.item.currentLocation,
                        ) && (
                          <p className="form-hint">
                            This item has a legacy location. Choose one of the approved storage
                            locations before saving.
                          </p>
                        )}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Created by</span>
                    <span>{data.item.createdByName ?? "—"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Last Updated</span>
                    <span>
                      {formatAuditDate(data.item.updatedAt)}
                      {data.item.updatedByName && ` by ${data.item.updatedByName}`}
                    </span>
                  </div>
                  {error && <p className="form-error">{error}</p>}
                </div>
              </div>
            </form>
          ) : (
            <div className="detail-card detail-card-with-media">
              <div className="detail-image-section">
                {data.item.imageUrl ? (
                  <div className="detail-image-frame">
                    <img
                      src={data.item.imageUrl}
                      alt={data.item.title}
                      className="detail-image-img"
                    />
                  </div>
                ) : (
                  <div className="image-placeholder-lg" />
                )}
              </div>

              <div className="detail-fields">
                <div className="detail-row">
                  <span className="detail-label">Status</span>
                  <StatusBadge variant={data.item.status === "ACTIVE" ? "active" : "retired"} />
                </div>
                <div className="detail-row">
                  <span className="detail-label">Item Name</span>
                  <span>{data.item.title}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Description</span>
                  <span>{data.item.description || "—"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Total Quantity</span>
                  <span>{data.item.quantity}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Location</span>
                  <span>{data.item.currentLocation || "—"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Created by</span>
                  <span>{data.item.createdByName ?? "—"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Last Updated</span>
                  <span>
                    {formatAuditDate(data.item.updatedAt)}
                    {data.item.updatedByName && ` by ${data.item.updatedByName}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="reservations-section">
            <h3 className="section-title">
              Active Reservations ({data.activeReservations.length})
            </h3>
            {data.activeReservations.length === 0 ? (
              <p className="empty-hint">No active reservations.</p>
            ) : (
              <table className="res-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date Range</th>
                    <th>Qty</th>
                    <th>Status</th>
                    <th>Requested By</th>
                    <th className="res-actions-header">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.activeReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>
                        <div className="reservation-event-cell">
                          <Link
                            href={`/events/${reservation.eventId}`}
                            className="event-title-link"
                          >
                            {reservation.eventName}
                          </Link>
                          <span className="reservation-event-meta">
                            {reservation.eventCompanyName}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="reservation-date-primary">
                          {formatShortDate(reservation.eventStartDate)}
                          {" – "}
                          {formatShortDate(reservation.eventEndDate, true)}
                        </span>
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
                      <td className="text-muted">{reservation.requestedByName}</td>
                      <td className="res-actions-cell">
                        <InventoryReservationRowActions
                          reservation={{
                            id: reservation.id,
                            status: reservation.status,
                            inventoryItemId: data.item.id,
                            inventoryItemTitle: data.item.title,
                            requestedById: reservation.requestedById,
                            eventName: reservation.eventName,
                            quantity: reservation.quantity,
                          }}
                          isAdmin={isAdmin}
                          userId={userId}
                          returnLocationOptions={data.returnLocationOptions}
                          fallbackHref={`/events/${reservation.eventId}`}
                          fallbackLabel="View Event"
                          disabled={isEditing}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="detail-side">
          <h3 className="section-title">Reservation History</h3>
          {data.reservationHistory.length === 0 ? (
            <p className="empty-hint">No past reservation history.</p>
          ) : (
            <div className="reservation-list">
              {data.reservationHistory.map((reservation) => (
                <div key={reservation.id} className="reservation-card">
                  <div className="res-top">
                    <span className="res-event">{reservation.eventName}</span>
                    <StatusBadge
                      variant={
                        reservation.status.toLowerCase() as Parameters<
                          typeof StatusBadge
                        >[0]["variant"]
                      }
                      label={getInventoryReservationStatusLabel(reservation.status)}
                    />
                  </div>
                  <div className="res-meta">
                    {reservation.eventCompanyName} · {formatShortDate(reservation.eventStartDate)}
                    {" – "}
                    {formatShortDate(reservation.eventEndDate, true)}
                  </div>
                  <div className="res-meta">
                    Qty: {reservation.quantity} · By: {reservation.requestedByName}
                    {reservation.approvedByName && ` · Approved: ${reservation.approvedByName}`}
                  </div>
                  {reservation.notes && <p className="res-notes">{reservation.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {data.item.status === "ACTIVE" && (
            <div className="detail-side-action">
              <InventoryDetailActions
                itemId={data.item.id}
                itemTitle={data.item.title}
                itemCurrentLocation={data.item.currentLocation || null}
                itemTotalQuantity={data.item.quantity}
                availableEvents={data.availableEvents}
                disabled={isEditing}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
