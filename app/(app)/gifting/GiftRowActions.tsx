"use client";

import { useState } from "react";
import Link from "next/link";
import { consumeGiftItem, activateGiftItem } from "./actions";

interface GiftItem {
  id: string;
  title: string;
  status: "ACTIVE" | "CONSUMED";
}

export function GiftRowActions({ item, isAdmin }: { item: GiftItem; isAdmin: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleStatusToggle() {
    setLoading(true);
    try {
      if (item.status === "ACTIVE") {
        await consumeGiftItem(item.id);
      } else {
        await activateGiftItem(item.id);
      }
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
      <style jsx>{`
        .row-actions { display: flex; gap: 6px; }
        .btn-action {
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          transition: background 0.12s;
          white-space: nowrap;
        }
        .btn-action:hover:not(:disabled) { background: #f3f4f6; }
        .btn-action:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </>
  );
}
