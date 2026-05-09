"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ReserveInventoryModal, type ReserveInventoryEventOption } from "@/components/ReserveInventoryModal";
import { useSetBulkSelectionActive } from "@/components/BulkSelectionContext";
import { LocationPinIcon } from "@/components/MetadataIcons";
import { useInventoryBulkDockSlot } from "@/components/PageShell";
import { InventoryActions } from "./InventoryActions";
import { InventoryImagePreview } from "./InventoryImagePreview";

interface InventoryTableItem {
  id: string;
  title: string;
  imageUrl: string | null;
  currentLocation: string | null;
  quantity: number;
  status: "ACTIVE" | "RETIRED";
  detailText: string;
  updatedDate: string;
  updatedByText: string | null;
  pendingCount: number;
  approvedCount: number;
  reserved: number;
}

interface InventoryTableProps {
  items: InventoryTableItem[];
  isAdmin: boolean;
  availableEvents: ReserveInventoryEventOption[];
}

export function InventoryTable({
  items,
  isAdmin,
  availableEvents,
}: InventoryTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reserveOpen, setReserveOpen] = useState(false);
  const bulkDockSlot = useInventoryBulkDockSlot();
  const setBulkSelectionActive = useSetBulkSelectionActive();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const selectableItems = items.filter((item) => item.status === "ACTIVE");
  const selectableItemIds = selectableItems.map((item) => item.id);
  const selectableItemIdSet = new Set(selectableItemIds);
  const showSelectionColumn = selectableItemIds.length > 0;
  const allSelected =
    selectableItemIds.length > 0 && selected.size === selectableItemIds.length;
  const someSelected =
    selected.size > 0 && selected.size < selectableItemIds.length;
  const selectedItems = selectableItems.filter((item) => selected.has(item.id));
  const selectedReservationItems = selectedItems.map((item) => ({
    id: item.id,
    title: item.title,
    currentLocation: item.currentLocation,
    totalQuantity: item.quantity,
  }));
  const columnCount = showSelectionColumn ? 8 : 7;

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(
        [...prev].filter((itemId) => selectableItemIdSet.has(itemId))
      );
      if (next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [items]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  useEffect(() => {
    setBulkSelectionActive(selected.size > 0);
  }, [selected.size, setBulkSelectionActive]);

  useEffect(() => {
    return () => {
      setBulkSelectionActive(false);
    };
  }, [setBulkSelectionActive]);

  function toggleOne(itemId: string) {
    if (!selectableItemIdSet.has(itemId)) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableItemIds));
    }
  }

  return (
    <>
      <div className="inventory-table-frame">
        <div className="table-container">
          <table className="data-table inventory-table">
            <thead>
              <tr>
                {showSelectionColumn && (
                  <th className="col-checkbox">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all active inventory items"
                    />
                  </th>
                )}
                <th className="col-image">
                  <span className="sr-only">Image</span>
                </th>
                <th className="col-item">Item</th>
                <th className="col-details">Details</th>
                <th className="col-qty">Qty</th>
                <th className="col-reserved">Reserved</th>
                <th className="col-location">Location</th>
                <th className="inventory-actions-header">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="empty-row">
                    No inventory items found.
                  </td>
                </tr>
              )}

              {items.map((item) => (
                <tr
                  key={item.id}
                  className={`table-row ${
                    item.status === "RETIRED" ? "row-retired" : ""
                  }${selected.has(item.id) ? " row-selected" : ""}`}
                >
                  {showSelectionColumn && (
                    <td className="col-checkbox">
                      {item.status === "ACTIVE" ? (
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleOne(item.id)}
                          aria-label={`Select ${item.title}`}
                        />
                      ) : (
                        <span className="row-selection-placeholder" aria-hidden="true" />
                      )}
                    </td>
                  )}
                  <td className="col-image">
                    <InventoryImagePreview src={item.imageUrl} alt={item.title} />
                  </td>
                  <td className="col-item">
                    <div className="inventory-item-cell">
                      <Link
                        href={`/inventory/${item.id}`}
                        className={`item-title-link inventory-item-link${
                          item.status === "RETIRED" ? " inventory-item-link-retired" : ""
                        }`}
                      >
                        {item.title}
                      </Link>
                      <div className="inventory-item-meta-row">
                        <span
                          className="inventory-item-meta-text"
                          title={
                            item.updatedByText
                              ? `Updated ${item.updatedDate} by ${item.updatedByText}`
                              : `Updated ${item.updatedDate}`
                          }
                        >
                          Updated {item.updatedDate}
                          {item.updatedByText ? ` by ${item.updatedByText}` : ""}
                        </span>
                        {item.pendingCount > 0 && (
                          <span className="action-status-chip action-status-chip-pending">
                            {item.pendingCount} pending
                          </span>
                        )}
                        {item.approvedCount > 0 && (
                          <span className="action-status-chip action-status-chip-approved">
                            {item.approvedCount} approved
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="col-details">
                    <span
                      className={`inventory-text-block inventory-details-text${
                        item.detailText ? "" : " inventory-details-empty"
                      }`}
                      title={item.detailText || undefined}
                    >
                      {item.detailText || "—"}
                    </span>
                  </td>
                  <td className="col-qty">
                    <span className="qty-primary">{item.quantity}</span>
                  </td>
                  <td className="col-reserved">
                    {item.reserved > 0 ? (
                      <span
                        className={`reserved-count${
                          item.reserved >= item.quantity ? " reserved-count-full" : ""
                        }`}
                      >
                        {item.reserved}
                      </span>
                    ) : (
                      <span className="reserved-count-none">—</span>
                    )}
                  </td>
                  <td className="col-location">
                    {item.currentLocation ? (
                      <span className="table-meta-inline inventory-location-inline">
                        <LocationPinIcon className="table-meta-icon" />
                        <span
                          className="inventory-text-block inventory-location-text"
                          title={item.currentLocation}
                        >
                          {item.currentLocation}
                        </span>
                      </span>
                    ) : (
                      <span className="inventory-text-block inventory-location-text">—</span>
                    )}
                  </td>
                  <td className="inventory-action-cell">
                    <InventoryActions
                      item={{
                        id: item.id,
                        title: item.title,
                        currentLocation: item.currentLocation,
                        quantity: item.quantity,
                        status: item.status,
                      }}
                      isAdmin={isAdmin}
                      availableEvents={availableEvents}
                      reservationState={{
                        pendingCount: item.pendingCount,
                        approvedCount: item.approvedCount,
                      }}
                      bulkSelectionActive={selected.size > 0}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showSelectionColumn && bulkDockSlot && selected.size > 0
        ? createPortal(
            <div className="inventory-bulk-dock-shell">
              <div
                className="inventory-bulk-dock inventory-bulk-dock-active"
              >
                <div className="inventory-bulk-dock-leading">
                  <span className="sr-only" aria-live="polite">
                    {selected.size} {selected.size === 1 ? "item" : "items"} selected
                  </span>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelected(new Set())}
                  >
                    Clear
                  </button>
                </div>

                <div className="inventory-bulk-dock-actions">
                  <button
                    type="button"
                    className="inventory-reserve-button"
                    onClick={() => setReserveOpen(true)}
                  >
                    <ReserveSelectedIcon className="inventory-reserve-icon" />
                    Reserve Selected
                  </button>
                </div>
              </div>
            </div>,
            bulkDockSlot
          )
        : null}

      <ReserveInventoryModal
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
        onSubmitted={() => setSelected(new Set())}
        availableEvents={availableEvents}
        initialSelectedItems={selectedReservationItems}
        title={`Reserve ${selected.size} ${selected.size === 1 ? "Item" : "Items"}`}
      />
    </>
  );
}

function ReserveSelectedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M141.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L124.69,128,50.34,53.66A8,8,0,0,1,61.66,42.34l80,80A8,8,0,0,1,141.66,133.66Zm80-11.32-80-80a8,8,0,0,0-11.32,11.32L204.69,128l-74.35,74.34a8,8,0,0,0,11.32,11.32l80-80A8,8,0,0,0,221.66,122.34Z" />
    </svg>
  );
}
