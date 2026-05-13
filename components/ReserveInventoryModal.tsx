"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { CalendarIcon, LocationPinIcon } from "@/components/MetadataIcons";
import {
  checkInventoryAvailability,
  createInventoryReservationsBatch,
  searchReservableInventoryItems,
} from "@/app/(app)/inventory/reservation-actions";
import { formatDateRange } from "@/lib/date-utils";

export interface ReserveInventoryEventOption {
  id: string;
  eventName: string;
  companyName: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface ReserveInventoryInitialItem {
  id: string;
  title: string;
  currentLocation?: string | null;
  totalQuantity?: number;
  quantity?: number;
}

const EMPTY_AVAILABLE_EVENTS: ReserveInventoryEventOption[] = [];
const EMPTY_INITIAL_SELECTED_ITEMS: ReserveInventoryInitialItem[] = [];

interface SearchResult {
  id: string;
  title: string;
  currentLocation: string | null;
  totalQuantity: number;
}

interface SelectedItem {
  id: string;
  title: string;
  currentLocation: string | null;
  totalQuantity?: number;
  quantity: number;
  quantityInput: string;
  availableQty: number | null;
  checkingAvailability: boolean;
}

interface ReserveInventoryModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  availableEvents?: ReserveInventoryEventOption[];
  presetEvent?: ReserveInventoryEventOption;
  initialSelectedItems?: ReserveInventoryInitialItem[];
  title?: string;
  subtitle?: string;
}

function buildSelectedItems(items: ReserveInventoryInitialItem[]): SelectedItem[] {
  return items.map((item) => ({
    quantity: item.quantity ?? 1,
    id: item.id,
    title: item.title,
    currentLocation: item.currentLocation ?? null,
    totalQuantity: item.totalQuantity,
    quantityInput: String(item.quantity ?? 1),
    availableQty: null,
    checkingAvailability: false,
  }));
}

function getIncrementedQuantity(item: SelectedItem) {
  const currentQuantity = Math.max(0, item.quantity);

  if (currentQuantity < 1) {
    return 1;
  }

  if (item.availableQty === null) {
    return currentQuantity + 1;
  }

  return Math.min(item.availableQty, currentQuantity + 1);
}

export function ReserveInventoryModal({
  open,
  onClose,
  onSubmitted,
  availableEvents = EMPTY_AVAILABLE_EVENTS,
  presetEvent,
  initialSelectedItems = EMPTY_INITIAL_SELECTED_ITEMS,
  title = "Reserve inventory",
  subtitle,
}: ReserveInventoryModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [eventId, setEventId] = useState(presetEvent?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedEvent =
    presetEvent ?? availableEvents.find((event) => event.id === eventId) ?? null;
  const activeEventId = selectedEvent?.id ?? "";
  const selectedItemIds = selectedItems.map((item) => item.id);
  const selectedIdsKey = selectedItemIds.join("|");
  const initialSelectedItemsKey = initialSelectedItems
    .map((item) =>
      [
        item.id,
        item.title,
        item.currentLocation ?? "",
        item.totalQuantity ?? "",
        item.quantity ?? 1,
      ].join(":"),
    )
    .join("|");
  const selectedIds = new Set(selectedItems.map((item) => item.id));
  const visibleSearchResults = searchResults.filter((item) => !selectedIds.has(item.id));
  const hasInvalidQuantity = selectedItems.some(
    (item) => item.quantity < 1 || item.quantityInput.trim() === "",
  );
  const hasAvailabilityConflict = selectedItems.some(
    (item) => item.availableQty !== null && item.quantity > item.availableQty,
  );
  const checkingAvailability = selectedItems.some((item) => item.checkingAvailability);
  const canSearchInventory = Boolean(selectedEvent);
  const canSelectSingleSearchResult =
    searchOpen && !searching && !searchError && visibleSearchResults.length === 1;
  const canSubmit =
    Boolean(activeEventId) &&
    selectedItems.length > 0 &&
    !hasInvalidQuantity &&
    !checkingAvailability &&
    !hasAvailabilityConflict &&
    !submitting;

  useEffect(() => {
    if (!open) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEventId(presetEvent?.id ?? "");
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setSubmitError("");
    setSubmitting(false);
    setSelectedItems(buildSelectedItems(initialSelectedItems));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetEvent?.id, initialSelectedItemsKey]);

  useEffect(() => {
    if (!open || !canSearchInventory || !searchOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults([]);
      setSearchError("");
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    searchReservableInventoryItems(deferredSearchQuery)
      .then((results) => {
        if (cancelled) return;
        setSearchResults(results);
        setSearchError("");
        setSearching(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSearchResults([]);
        setSearchError(err instanceof Error ? err.message : "Failed to search inventory.");
        setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, deferredSearchQuery, canSearchInventory, searchOpen]);

  useEffect(() => {
    if (!open) return;

    if (!activeEventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedItems((current) =>
        current.map((item) => ({
          ...item,
          availableQty: null,
          checkingAvailability: false,
        })),
      );
      return;
    }

    if (!selectedIdsKey) return;

    let cancelled = false;
    const itemIds = selectedIdsKey.split("|").filter(Boolean);

    setSelectedItems((current) =>
      current.map((item) =>
        itemIds.includes(item.id) ? { ...item, checkingAvailability: true } : item,
      ),
    );

    Promise.all(
      itemIds.map(async (itemId) => ({
        itemId,
        availableQty: await checkInventoryAvailability(itemId, activeEventId),
      })),
    )
      .then((results) => {
        if (cancelled) return;
        const availabilityMap = new Map(
          results.map((result) => [result.itemId, result.availableQty]),
        );

        setSelectedItems((current) =>
          current.map((item) => ({
            ...item,
            availableQty: availabilityMap.get(item.id) ?? null,
            checkingAvailability: false,
          })),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSubmitError(err instanceof Error ? err.message : "Failed to load availability.");
        setSelectedItems((current) =>
          current.map((item) => ({
            ...item,
            availableQty: null,
            checkingAvailability: false,
          })),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [open, activeEventId, selectedIdsKey]);

  function handleAddItem(item: SearchResult) {
    setSelectedItems((current) => [
      ...current,
      {
        id: item.id,
        title: item.title,
        currentLocation: item.currentLocation,
        totalQuantity: item.totalQuantity,
        quantity: 1,
        quantityInput: "1",
        availableQty: null,
        checkingAvailability: false,
      },
    ]);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setSearchOpen(false);
    setSubmitError("");
    searchInputRef.current?.blur();
  }

  function handleRemoveItem(itemId: string) {
    setSelectedItems((current) => current.filter((item) => item.id !== itemId));
  }

  function handleQuantityChange(itemId: string, value: string) {
    const nextValue = value.replace(/\D+/g, "");

    setSelectedItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantityInput: nextValue,
              quantity: nextValue ? Math.floor(Number(nextValue)) : 0,
            }
          : item,
      ),
    );
  }

  function handleQuantityBlur(itemId: string) {
    setSelectedItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? item.quantity > 0
            ? {
                ...item,
                quantityInput: String(item.quantity),
              }
            : {
                ...item,
                quantity: 1,
                quantityInput: "1",
              }
          : item,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeEventId) {
      setSubmitError("Select an event before reserving inventory.");
      return;
    }
    if (selectedItems.length === 0) {
      setSubmitError("Add at least one inventory item before reserving.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const result = await createInventoryReservationsBatch({
        eventId: activeEventId,
        items: selectedItems.map((item) => ({
          inventoryItemId: item.id,
          quantity: item.quantity,
        })),
      });

      onClose();
      onSubmitted?.();
      const multipleReservations = result.count !== 1;
      const updatedOnly = result.mergedCount > 0 && result.createdCount === 0;

      if (result.autoApproved) {
        toast(
          updatedOnly
            ? multipleReservations
              ? "Reservations updated"
              : "Reservation updated"
            : result.count === 1
              ? "Reservation approved"
              : `${result.count} reservations approved`,
        );
      } else if (result.revertedToPendingCount > 0) {
        toast(
          multipleReservations
            ? "Reservations updated and pending approval"
            : "Reservation updated and pending approval",
        );
      } else if (updatedOnly) {
        toast(
          multipleReservations ? "Reservation requests updated" : "Reservation request updated",
        );
      } else {
        toast(
          result.count === 1
            ? "Reservation pending approval"
            : `${result.count} reservations pending approval`,
        );
      }
      router.refresh();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit reservation.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleIncrementQuantity(itemId: string) {
    setSelectedItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: Math.max(1, getIncrementedQuantity(item)),
              quantityInput: String(Math.max(1, getIncrementedQuantity(item))),
            }
          : item,
      ),
    );
  }

  function handleDecrementQuantity(itemId: string) {
    setSelectedItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: Math.max(1, item.quantity - 1),
              quantityInput: String(Math.max(1, item.quantity - 1)),
            }
          : item,
      ),
    );
  }

  const totalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const showSearchDropdown = canSearchInventory && searchOpen;

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg" bodyClassName="reserve-modal-body">
      <form onSubmit={handleSubmit} className="modal-form reserve-modal-form">
        {subtitle && <p className="event-info-detail modal-helper-text">{subtitle}</p>}

        {!presetEvent && (
          <div className="form-field">
            <label className="form-label">Event *</label>
            <select
              className="form-input"
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                setSearchQuery("");
                setSearchResults([]);
                setSearchError("");
                setSubmitError("");
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
        )}

        {selectedEvent && (
          <div className="event-info-box">
            {selectedEvent.location ? (
              <span className="table-meta-inline">
                <LocationPinIcon className="table-meta-icon" />
                <span className="event-info-detail">{selectedEvent.location}</span>
              </span>
            ) : null}
            {selectedEvent.startDate || selectedEvent.endDate ? (
              <span className="table-meta-inline">
                <CalendarIcon className="table-meta-icon" />
                <span className="event-info-detail">
                  {formatDateRange(selectedEvent.startDate, selectedEvent.endDate)}
                </span>
              </span>
            ) : null}
            <span className="event-info-detail">
              Availability is based on this event. Pending requests do not hold stock until
              approved.
            </span>
          </div>
        )}

        {!presetEvent && availableEvents.length === 0 && (
          <p className="form-error-inline">
            No current or upcoming events are available for reservations.
          </p>
        )}

        <div className="form-field reserve-search-field">
          <label className="form-label">Search inventory</label>
          <div
            className="reserve-search-area"
            onFocus={() => {
              if (canSearchInventory) {
                setSearchOpen(true);
              }
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setSearchOpen(false);
              }
            }}
          >
            <div className="reserve-search-input-wrap">
              <SearchIcon className="reserve-search-icon" />
              <input
                ref={searchInputRef}
                type="search"
                className="form-input reserve-search-input"
                placeholder={
                  canSearchInventory ? "Type to search inventory items..." : "Select an event first"
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !canSelectSingleSearchResult) {
                    return;
                  }

                  e.preventDefault();
                  handleAddItem(visibleSearchResults[0]);
                }}
                disabled={!canSearchInventory}
              />
            </div>

            {showSearchDropdown && (
              <div
                className="reserve-search-results"
                role="listbox"
                aria-label="Inventory search results"
              >
                {searching ? (
                  <p className="reserve-search-state">Searching inventory…</p>
                ) : searchError ? (
                  <p className="reserve-search-state">{searchError}</p>
                ) : visibleSearchResults.length === 0 ? (
                  <p className="reserve-search-state">No inventory items found.</p>
                ) : (
                  visibleSearchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="reserve-search-result"
                      onClick={() => handleAddItem(item)}
                    >
                      <span className="reserve-search-result-main">
                        <span className="reserve-search-result-title">{item.title}</span>
                        {item.currentLocation ? (
                          <span className="reserve-search-result-meta">{item.currentLocation}</span>
                        ) : null}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="form-field reserve-selected-field">
          <label className="form-label">Items to reserve ({selectedItems.length})</label>

          {selectedItems.length === 0 ? (
            <div className="event-info-box">
              <span className="event-info-detail">
                Search and select inventory items to reserve for this event.
              </span>
            </div>
          ) : (
            <div className="reserve-selected-list">
              {selectedItems.map((item) => (
                <div key={item.id} className="reserve-selected-item">
                  <div className="reserve-selected-copy">
                    <span className="reserve-selected-title">{item.title}</span>
                    {item.currentLocation ? (
                      <span className="reserve-selected-meta">{item.currentLocation}</span>
                    ) : null}
                    <span className="event-info-detail reserve-availability">
                      {item.checkingAvailability
                        ? "Checking availability…"
                        : item.availableQty !== null
                          ? `Available for this event: ${item.availableQty}${typeof item.totalQuantity === "number" ? ` of ${item.totalQuantity}` : ""}`
                          : "Select an event to see availability for this event"}
                    </span>
                    {item.availableQty !== null && item.quantity > item.availableQty && (
                      <span className="form-error-inline">
                        Only {item.availableQty} available for this event.
                      </span>
                    )}
                  </div>

                  <div className="reserve-selected-controls">
                    <div className="reserve-qty-stepper">
                      <button
                        type="button"
                        className="reserve-step-button"
                        onClick={() => handleDecrementQuantity(item.id)}
                        disabled={item.quantity <= 1}
                        aria-label={`Decrease quantity for ${item.title}`}
                      >
                        <MinusIcon className="reserve-step-icon" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="reserve-qty-input"
                        aria-label={`Quantity for ${item.title}`}
                        value={item.quantityInput}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        onBlur={() => handleQuantityBlur(item.id)}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <button
                        type="button"
                        className="reserve-step-button"
                        onClick={() => handleIncrementQuantity(item.id)}
                        disabled={item.availableQty !== null && item.quantity >= item.availableQty}
                        aria-label={`Increase quantity for ${item.title}`}
                      >
                        <PlusIcon className="reserve-step-icon" />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="reserve-remove-icon"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label={`Remove ${item.title}`}
                    >
                      <TrashIcon className="reserve-remove-icon-svg" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {submitError && <p className="form-error">{submitError}</p>}

        <div className="modal-actions reserve-modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-dark" disabled={!canSubmit}>
            {submitting
              ? "Submitting…"
              : totalItems > 0
                ? `Reserve ${totalItems} ${totalItems === 1 ? "Item" : "Items"} for Event`
                : "Reserve Items for Event"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
