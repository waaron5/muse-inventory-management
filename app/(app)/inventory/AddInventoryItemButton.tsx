"use client";

import { useRouter } from "next/navigation";
import { useBulkSelectionActive } from "@/components/BulkSelectionContext";

export function AddInventoryItemButton() {
  const router = useRouter();
  const bulkSelectionActive = useBulkSelectionActive();

  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => router.push("/inventory/new")}
      disabled={bulkSelectionActive}
      title={
        bulkSelectionActive
          ? "Clear bulk selection before adding a new item."
          : undefined
      }
    >
      + Add Item
    </button>
  );
}
