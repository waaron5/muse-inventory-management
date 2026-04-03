"use client";

import { useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/Modal";

export function InventoryImagePreview({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
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
          <Image
            src={src}
            alt={alt}
            width={40}
            height={40}
            style={{ objectFit: "cover", borderRadius: 4 }}
          />
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
            fill
            sizes="(max-width: 768px) 90vw, 640px"
            className="inventory-image-preview-img"
          />
        </div>
      </Modal>
    </>
  );
}
