"use client";

import { useState } from "react";
import Link from "next/link";
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

  async function handleRetireToggle() {
    setLoading(true);
    try {
      if (item.status === "ACTIVE") {
        await retireInventoryItem(item.id);
      } else {
        await activateInventoryItem(item.id);
      }
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

      <style jsx>{`
        .row-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
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
          transition: background 0.12s, border-color 0.12s;
          white-space: nowrap;
        }
        .btn-action:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
        .btn-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-action-admin {
          font-size: 12px;
        }
      `}</style>
    </>
  );
}
