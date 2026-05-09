"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

export function InventoryImagePreview({ src, alt }: { src: string | null; alt: string }) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return (
      <div className="item-image">
        <div className="image-placeholder" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="inventory-image-button"
        onClick={() => setOpen(true)}
        aria-label={`View larger image for ${alt}`}
        title={`View larger image for ${alt}`}
      >
        <span className="item-image">
          <img src={src} alt={alt} className="item-image-img" />
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={alt}
        size="lg"
        bodyClassName="inventory-image-modal-body"
      >
        <div className="inventory-image-preview-frame">
          <img src={src} alt={alt} className="inventory-image-preview-img" />
        </div>
      </Modal>
    </>
  );
}
