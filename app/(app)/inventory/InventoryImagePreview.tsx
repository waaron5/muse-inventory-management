"use client";

import Image from "next/image";
import { useState } from "react";
import { Modal } from "@/components/Modal";

export function InventoryImagePreview({ src, alt }: { src: string | null; alt: string }) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return <div className="item-image image-placeholder" />;
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
          <Image src={src} alt={alt} className="item-image-img" fill sizes="48px" />
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
          <Image
            src={src}
            alt={alt}
            className="inventory-image-preview-img"
            fill
            sizes="(max-width: 768px) 100vw, 70vw"
          />
        </div>
      </Modal>
    </>
  );
}
