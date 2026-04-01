"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { createGiftItem, updateGiftItem } from "./actions";
import Link from "next/link";

interface GiftFormProps {
  mode: "create" | "edit";
  item?: {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    quantity: number;
    notes: string;
  };
}

export function GiftForm({ mode, item }: GiftFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
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
        notes: notes || undefined,
      };

      if (mode === "create") {
        const res = await createGiftItem(formData);
        router.push(`/gifting/${res.id}`);
      } else {
        await updateGiftItem(item!.id, formData);
        router.push(`/gifting/${item!.id}`);
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
        <Link href={mode === "edit" ? `/gifting/${item?.id}` : "/gifting"} className="back-link">
          ← Back
        </Link>
      </div>

      <PageHeader
        title={mode === "create" ? "Add Gift Item" : `Edit "${item?.title}"`}
        subtitle={
          mode === "create"
            ? "Add a new item to the gifting catalogue"
            : "Update gift item details"
        }
      />

      <div className="form-container">
        <form onSubmit={handleSubmit} className="gift-form">
          <div className="form-grid">
            <div className="form-field form-field-wide">
              <label className="form-label">Item Name <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Crystal Award"
              />
            </div>

            <div className="form-field form-field-wide">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the item"
              />
            </div>

            <div className="form-field">
              <label className="form-label">Quantity <span className="required">*</span></label>
              <input
                type="number"
                className="form-input"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
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
                placeholder="Any special notes about this gift item…"
              />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-footer">
            <Link
              href={mode === "edit" ? `/gifting/${item?.id}` : "/gifting"}
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
        .back-link-wrap { margin-bottom: 16px; }
        .back-link { font-size: 14px; color: #6b7280; text-decoration: none; }
        .back-link:hover { color: #111827; }
        .form-container {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 28px;
          max-width: 680px;
        }
        .gift-form { display: flex; flex-direction: column; gap: 20px; }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .form-field-wide { grid-column: 1 / -1; }
        .form-label { font-size: 13px; font-weight: 500; color: #374151; }
        .required { color: #dc2626; }
        .form-input {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
          box-sizing: border-box;
          font-family: inherit;
        }
        .form-input:focus { border-color: #111827; }
        .form-error { color: #dc2626; font-size: 13px; margin: 0; }
        .form-footer { display: flex; justify-content: flex-end; gap: 10px; }
        .btn {
          display: inline-flex;
          align-items: center;
          border-radius: 8px;
          padding: 9px 18px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.12s;
        }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-dark { background: #111827; color: white; border: none; }
        .btn-dark:hover:not(:disabled) { background: #1f2937; }
        .btn-outline { border: 1px solid #d1d5db; background: white; color: #374151; }
        .btn-outline:hover { background: #f3f4f6; }
      `}</style>
    </>
  );
}
