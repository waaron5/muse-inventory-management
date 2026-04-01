"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? 0);
  const [currentLocation, setCurrentLocation] = useState(item?.currentLocation ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = {
        title,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
        quantity,
        currentLocation: currentLocation || undefined,
        notes: notes || undefined,
      };

      if (mode === "create") {
        const res = await createInventoryItem(formData);
        router.push(`/inventory/${res.id}`);
      } else {
        await updateInventoryItem(item!.id, formData);
        router.push(`/inventory/${item!.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="back-link-wrap">
        <Link href={mode === "edit" ? `/inventory/${item?.id}` : "/inventory"} className="back-link">
          ← Back
        </Link>
      </div>

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
              <label className="form-label">Item Name *</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
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
                placeholder="e.g. JP Display"
              />
            </div>

            <div className="form-field form-field-wide">
              <label className="form-label">Image URL</label>
              <input
                type="url"
                className="form-input"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="form-field form-field-wide">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special notes about this item…"
              />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-footer">
            <Link
              href={mode === "edit" ? `/inventory/${item?.id}` : "/inventory"}
              className="btn btn-outline"
            >
              Cancel
            </Link>
            <button type="submit" className="btn btn-dark" disabled={loading}>
              {loading
                ? mode === "create"
                  ? "Adding…"
                  : "Saving…"
                : mode === "create"
                  ? "Add Item"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .back-link-wrap {
          margin-bottom: 16px;
        }
        .back-link {
          font-size: 14px;
          color: #6b7280;
          text-decoration: none;
        }
        .back-link:hover {
          color: #111827;
        }
        .form-container {
          max-width: 680px;
        }
        .inv-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 24px;
        }
        .form-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .form-field-wide {
          grid-column: 1 / -1;
        }
        .form-label {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
        }
        .form-input {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
          resize: vertical;
        }
        .form-input:focus {
          border-color: #00b4d8;
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.1);
        }
        .form-error {
          background: #fee2e2;
          border: 1px solid #fca5a5;
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 13px;
          color: #991b1b;
          margin: 0;
        }
        .form-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
          padding: 9px 18px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.12s, opacity 0.15s;
          white-space: nowrap;
          border: none;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-dark {
          background: #111827;
          color: white;
        }
        .btn-dark:hover:not(:disabled) {
          background: #1f2937;
        }
        .btn-outline {
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
        }
        .btn-outline:hover {
          background: #f3f4f6;
        }
      `}</style>
    </>
  );
}
