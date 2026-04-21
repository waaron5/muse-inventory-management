"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { activateGiftItem, consumeGiftItem } from "../actions";

export function GiftHeaderActions({
  itemId,
  itemTitle,
}: {
  itemId: string;
  itemTitle: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${itemTitle}"? It will be marked used and moved to the bottom of gifting.`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      await consumeGiftItem(itemId);
      toast("Item deleted", "success", {
        duration: 10000,
        actionLabel: "Undo",
        onAction: async () => {
          await activateGiftItem(itemId);
          router.refresh();
          toast("Item restored");
        },
      });
      router.push("/gifting");
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : "Failed to delete item", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Link
        href={`/gifting/${itemId}/edit`}
        className="btn btn-outline"
        aria-label={`Edit ${itemTitle}`}
      >
        <EditIcon />
        Edit
      </Link>
      <button
        type="button"
        className="btn btn-outline-danger"
        onClick={handleDelete}
        disabled={loading}
        aria-label={`Delete ${itemTitle}`}
        title={`Delete ${itemTitle}`}
      >
        {loading ? <span aria-hidden="true">…</span> : <TrashIcon />}
        Delete
      </button>
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
