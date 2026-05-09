"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { useSetTopBar } from "@/components/TopBarContext";
import { InlineItemImageField } from "@/components/InlineItemImageField";
import { uploadManagedItemImage } from "@/lib/item-image-client";
import { createInventoryItem, updateInventoryItem } from "./actions";

interface InventoryFormProps {
  locationOptions: string[];
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

export function InventoryForm({
  locationOptions,
  mode,
  item,
}: InventoryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? 0);
  const initialLocation =
    item?.currentLocation && locationOptions.includes(item.currentLocation)
      ? item.currentLocation
      : "";
  const [currentLocation, setCurrentLocation] = useState(initialLocation);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const existingImageUrl = item?.imageUrl?.trim() || null;
  const displayedImageUrl =
    selectedImagePreviewUrl ?? (removeExistingImage ? null : existingImageUrl);
  const inventoryReturnHref = "/inventory";

  const titleNode = useMemo(
    () => (
      <ol className="bc-list" aria-label="Breadcrumb">
        <li className="bc-item">
          <Link href="/inventory" className="bc-link">Inventory</Link>
        </li>
        {mode === "edit" && item && (
          <li className="bc-item">
            <span className="bc-sep" aria-hidden="true">/</span>
            <Link href={`/inventory/${item.id}`} className="bc-link">{item.title}</Link>
          </li>
        )}
        <li className="bc-item">
          <span className="bc-sep" aria-hidden="true">/</span>
          <span className="bc-current">{mode === "create" ? "New Item" : "Edit"}</span>
        </li>
      </ol>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, item?.id]
  );

  const actionsNode = useMemo(
    () => (
      <>
        <Link href={inventoryReturnHref} className="btn btn-outline">
          Cancel
        </Link>
        <button type="submit" form="inventory-item-form" className="btn btn-dark" disabled={loading}>
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
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, uploadingImage, mode]
  );

  useSetTopBar(titleNode, actionsNode);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setImageError("");
    setLoading(true);

    try {
      let uploadedImageUrl: string | null = removeExistingImage ? null : existingImageUrl;

      if (selectedImageFile) {
        setUploadingImage(true);
        uploadedImageUrl = await uploadManagedItemImage(selectedImageFile);
      }

      const formData = {
        title,
        description: description || undefined,
        imageUrl: uploadedImageUrl,
        quantity,
        currentLocation,
        notes: notes || undefined,
      };

      if (mode === "create") {
        const res = await createInventoryItem(formData);
        toast("Item added to inventory");
        router.push(`/inventory/${res.id}`);
      } else {
        await updateInventoryItem(item!.id, formData);
        toast("Item updated");
        router.push(inventoryReturnHref);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploadingImage(false);
      setLoading(false);
    }
  }

  return (
    <div className="form-container">
      <form id="inventory-item-form" onSubmit={handleSubmit} className="inv-form">
          <div className="form-grid">
            <InlineItemImageField
              displayedImageUrl={displayedImageUrl}
              selectedImageFile={selectedImageFile}
              imageError={imageError}
              disabled={loading}
              onFileSelected={(file) => {
                setImageError("");
                setSelectedImageFile(file);
                setRemoveExistingImage(false);
              }}
              onClear={() => {
                setImageError("");
                if (selectedImageFile) {
                  setSelectedImageFile(null);
                } else {
                  setRemoveExistingImage(true);
                }
              }}
              onError={setImageError}
            />

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
              <label className="form-label">Current Location *</label>
              <select
                className="form-input"
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
                required
              >
                <option value="">Select a location</option>
                {locationOptions.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
              {mode === "edit" &&
                item?.currentLocation &&
                !locationOptions.includes(item.currentLocation) && (
                  <p className="form-hint">
                    This item has a legacy location. Choose one of the approved
                    storage locations before saving.
                  </p>
                )}
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
        </form>
    </div>
  );
}

