"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { retireInventoryItem, activateInventoryItem } from "./actions";

interface Item {
  id: string;
  title: string;
  status: "ACTIVE" | "RETIRED";
}

export function InventoryActions({
  item,
  isAdmin,
}: {
  item: Item;
  isAdmin: boolean;
}) {
  const [loading, setLoading] = useState(false);
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
    </>
  );
}
