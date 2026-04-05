"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useToast } from "@/components/Toast";
import {
  INVENTORY_IMAGE_ACCEPT_ATTRIBUTE,
  INVENTORY_IMAGE_REQUIREMENTS_TEXT,
  validateInventoryImageFile,
} from "@/lib/inventory-image";
import { createInventoryItem, updateInventoryItem } from "./actions";
import Link from "next/link";

interface InventoryFormProps {
  mode: "create" | "edit";
  item?: {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    quantity: number;
    currentLocation: string;
    notes: string;
  };
}

export function InventoryForm({ mode, item }: InventoryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? 0);
  const [currentLocation, setCurrentLocation] = useState(item?.currentLocation ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const existingImageUrl = item?.imageUrl?.trim() || null;
  const displayedImageUrl =
    selectedImagePreviewUrl ?? (removeExistingImage ? null : existingImageUrl);

  useEffect(() => {
    if (!selectedImageFile) {
      setSelectedImagePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImageFile);
    setSelectedImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImageFile]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function clearFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleImageSelection(e: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = e.target.files?.[0];
    if (!nextFile) return;

    const validationError = validateInventoryImageFile(nextFile);
    if (validationError) {
      setImageError(validationError);
      clearFileInput();
      return;
    }

    setImageError("");
    setSelectedImageFile(nextFile);
    setRemoveExistingImage(false);
  }

  function handleClearImage() {
    setImageError("");

    if (selectedImageFile) {
      setSelectedImageFile(null);
      clearFileInput();
      return;
    }

    setRemoveExistingImage(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setImageError("");
    setLoading(true);

    try {
      let uploadedImageUrl: string | null = removeExistingImage ? null : existingImageUrl;

      if (selectedImageFile) {
        setUploadingImage(true);
        uploadedImageUrl = await uploadInventoryImage(selectedImageFile);
      }

      const formData = {
        title,
        description: description || undefined,
        imageUrl: uploadedImageUrl,
        quantity,
        currentLocation: currentLocation || undefined,
        notes: notes || undefined,
      };

      if (mode === "create") {
        const res = await createInventoryItem(formData);
        toast("Item added to inventory");
        router.push(`/inventory/${res.id}`);
      } else {
        await updateInventoryItem(item!.id, formData);
        toast("Item updated");
        router.push(`/inventory/${item!.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploadingImage(false);
      setLoading(false);
    }
  }

  return (
    <>
      <Breadcrumbs items={[
        { label: "Inventory", href: "/inventory" },
        ...(mode === "edit" && item ? [{ label: item.title, href: `/inventory/${item.id}` }] : []),
        { label: mode === "create" ? "New Item" : "Edit" },
      ]} />

      <PageHeader
        title={mode === "create" ? "Add Inventory Item" : `Edit "${item?.title}"`}
        subtitle={
          mode === "create"
            ? "Add a new item to the inventory"
            : "Update inventory item details"
        }
      />

      <div className="form-container">
        <form onSubmit={handleSubmit} className="inv-form">
          <div className="form-grid">
            <div className="form-field form-field-wide">
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
                className={`inventory-image-upload-box${
                  displayedImageUrl ? " inventory-image-upload-box-filled" : ""
                }`}
                onClick={openFilePicker}
                disabled={loading}
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
                    onClick={handleClearImage}
                    disabled={loading}
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

            <div className="form-field form-field-wide">
              <label className="form-label">Item Name *</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                placeholder="e.g. Award Platforms"
              />
            </div>

            <div className="form-field form-field-wide">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                placeholder="e.g. 6&quot; H, 36&quot; Square"
              />
            </div>

            <div className="form-field">
              <label className="form-label">Quantity *</label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label">Current Location</label>
              <input
                type="text"
                className="form-input"
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
                maxLength={200}
                placeholder="e.g. JP Display"
              />
            </div>

            <div className="form-field form-field-wide">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                placeholder="Any special notes about this item…"
              />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-footer page-form-footer">
            <Link
              href={mode === "edit" ? `/inventory/${item?.id}` : "/inventory"}
              className="btn btn-outline"
            >
              Cancel
            </Link>
            <button type="submit" className="btn btn-dark" disabled={loading}>
              {loading
                ? uploadingImage
                  ? "Uploading…"
                  : mode === "create"
                    ? "Adding…"
                    : "Saving…"
                : mode === "create"
                  ? "Add Item"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

async function uploadInventoryImage(file: File) {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/inventory-images", {
    method: "POST",
    body,
  });

  const payload = (await response.json().catch(() => null)) as
    | { imageUrl?: string; error?: string }
    | null;

  if (!response.ok || !payload?.imageUrl) {
    throw new Error(payload?.error ?? "Unable to upload image.");
  }

  return payload.imageUrl;
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
