"use client";

import { useEffect, useRef } from "react";
import {
  INVENTORY_IMAGE_ACCEPT_ATTRIBUTE,
  INVENTORY_IMAGE_REQUIREMENTS_TEXT,
  validateInventoryImageFile,
} from "@/lib/inventory-image";

interface InlineItemImageFieldProps {
  displayedImageUrl: string | null;
  selectedImageFile: File | null;
  imageError: string;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  onError: (message: string) => void;
}

export function InlineItemImageField({
  displayedImageUrl,
  selectedImageFile,
  imageError,
  disabled = false,
  onFileSelected,
  onClear,
  onError,
}: InlineItemImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectedImageFile && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [selectedImageFile]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function clearFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleImageSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    const validationError = validateInventoryImageFile(nextFile);
    if (validationError) {
      onError(validationError);
      clearFileInput();
      return;
    }

    onError("");
    onFileSelected(nextFile);
  }

  function handleClear() {
    clearFileInput();
    onClear();
  }

  return (
    <div className="detail-image-edit-field">
      <label className="form-label">Item Image</label>
      <input
        ref={fileInputRef}
        type="file"
        accept={INVENTORY_IMAGE_ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={handleImageSelection}
      />
      <button
        type="button"
        className={`inventory-image-upload-box detail-image-upload-box${
          displayedImageUrl ? " inventory-image-upload-box-filled" : ""
        }`}
        onClick={openFilePicker}
        disabled={disabled}
        aria-label={displayedImageUrl ? "Replace item image" : "Upload item image"}
      >
        {displayedImageUrl ? (
          <>
            <span className="inventory-image-upload-preview">
              <img
                src={displayedImageUrl}
                alt=""
                className="inventory-image-upload-preview-img"
              />
            </span>
            <span className="inventory-image-upload-copy inventory-image-upload-copy-left">
              <span className="inventory-image-upload-meta">
                {INVENTORY_IMAGE_REQUIREMENTS_TEXT}
              </span>
            </span>
            <ImageUploadIcon className="inventory-image-upload-icon inventory-image-upload-icon-right" />
          </>
        ) : (
          <>
            <span className="inventory-image-upload-icon-wrap">
              <ImageUploadIcon className="inventory-image-upload-icon" />
            </span>
            <span className="inventory-image-upload-meta">
              {INVENTORY_IMAGE_REQUIREMENTS_TEXT}
            </span>
          </>
        )}
      </button>
      {(displayedImageUrl || selectedImageFile) && (
        <div className="inventory-image-upload-actions">
          <button
            type="button"
            className="inventory-image-upload-link"
            onClick={handleClear}
            disabled={disabled}
          >
            {selectedImageFile ? "Discard new image" : "Remove image"}
          </button>
          {selectedImageFile && (
            <span className="inventory-image-upload-status">
              This image will upload when you save.
            </span>
          )}
        </div>
      )}
      {imageError && <p className="form-error-inline">{imageError}</p>}
    </div>
  );
}

function ImageUploadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M208,40H48A16,16,0,0,0,32,56V176a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V56A16,16,0,0,0,208,40ZM52.69,168,92,116l28.69,38.25L132,139.2a8,8,0,0,1,12.79,0L180,184H48A7.93,7.93,0,0,1,52.69,168ZM208,176a7.92,7.92,0,0,1-3.37,6.49L157.6,119.8a24,24,0,0,0-38.39,0l-6.4,8.53L104.4,117.2a16,16,0,0,0-25.6,0L48,158.4V56H208ZM164,96a12,12,0,1,1,12,12A12,12,0,0,1,164,96Z" />
    </svg>
  );
}
