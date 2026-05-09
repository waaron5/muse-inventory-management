"use client";

import { useState } from "react";
import { GiftUseModal, type GiftUseEventOption } from "@/components/GiftUseModal";

interface GiftDetailActionsProps {
  itemId: string;
  itemTitle: string;
  itemTotalQuantity: number;
  availableEvents: GiftUseEventOption[];
  disabled?: boolean;
}

export function GiftDetailActions({
  itemId,
  itemTitle,
  itemTotalQuantity,
  availableEvents,
  disabled = false,
}: GiftDetailActionsProps) {
  const [useOpen, setUseOpen] = useState(false);

  return (
    <>
      <div className="action-bar">
        <button
          type="button"
          className="btn btn-dark"
          onClick={() => setUseOpen(true)}
          disabled={disabled}
        >
          Use this item
        </button>
      </div>

      <GiftUseModal
        open={useOpen}
        onClose={() => setUseOpen(false)}
        availableEvents={availableEvents}
        giftItem={{
          id: itemId,
          title: itemTitle,
          totalQuantity: itemTotalQuantity,
        }}
        title={`Use "${itemTitle}"`}
      />
    </>
  );
}
