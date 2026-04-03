"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReserveInventoryModal, type ReserveInventoryEventOption } from "@/components/ReserveInventoryModal";
import { useToast } from "@/components/Toast";
import { retireInventoryItem, activateInventoryItem } from "./actions";

interface Item {
  id: string;
  title: string;
  currentLocation: string | null;
  quantity: number;
  status: "ACTIVE" | "RETIRED";
}

export function InventoryActions({
  item,
  isAdmin,
  availableEvents,
}: {
  item: Item;
  isAdmin: boolean;
  availableEvents: ReserveInventoryEventOption[];
}) {
  const [loading, setLoading] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function handleRetireToggle() {
    if (
      item.status === "ACTIVE" &&
      !confirm(`Retire "${item.title}"? It will no longer be available for new reservations.`)
    ) return;
    setLoading(true);
    try {
      if (item.status === "ACTIVE") {
        await retireInventoryItem(item.id);
        toast(`"${item.title}" retired`);
      } else {
        await activateInventoryItem(item.id);
        toast(`"${item.title}" re-activated`);
      }
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="row-actions">
        <Link href={`/inventory/${item.id}`} className="btn-action">
          Open
        </Link>
        {item.status === "ACTIVE" && (
          <button
            type="button"
            className="btn-action btn-action-primary"
            onClick={() => setReserveOpen(true)}
          >
            Reserve
          </button>
        )}
        {isAdmin && (
          <>
            <Link href={`/inventory/${item.id}/edit`} className="btn-action btn-action-admin">
              Edit
            </Link>
            <button
              className="btn-action btn-action-admin"
              onClick={handleRetireToggle}
              disabled={loading}
            >
              {loading ? "…" : item.status === "ACTIVE" ? "Retire" : "Activate"}
            </button>
          </>
        )}
      </div>

      <ReserveInventoryModal
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
        availableEvents={availableEvents}
        initialSelectedItems={[
          {
            id: item.id,
            title: item.title,
            currentLocation: item.currentLocation,
            totalQuantity: item.quantity,
          },
        ]}
        title={`Reserve "${item.title}"`}
        subtitle="Choose an event, adjust quantity, and add more inventory for the same reservation request if needed."
      />
    </>
  );
}
