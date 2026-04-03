"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { consumeGiftItem, activateGiftItem } from "./actions";

interface GiftItem {
  id: string;
  title: string;
  status: "ACTIVE" | "CONSUMED";
}

export function GiftRowActions({ item, isAdmin }: { item: GiftItem; isAdmin: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function handleStatusToggle() {
    if (
      item.status === "ACTIVE" &&
      !confirm(`Mark "${item.title}" as consumed? This indicates the gift has been used up.`)
    ) return;
    setLoading(true);
    try {
      if (item.status === "ACTIVE") {
        await consumeGiftItem(item.id);
        toast(`"${item.title}" marked as consumed`);
      } else {
        await activateGiftItem(item.id);
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
        <Link href={`/gifting/${item.id}`} className="btn-action">
          Open
        </Link>
        {isAdmin && (
          <>
            <Link href={`/gifting/${item.id}/edit`} className="btn-action">
              Edit
            </Link>
            <button
              className="btn-action"
              onClick={handleStatusToggle}
              disabled={loading}
            >
              {loading ? "…" : item.status === "ACTIVE" ? "Consume" : "Activate"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
