"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useToast } from "@/components/Toast";
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
  const { toast } = useToast();
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
        toast("Gift item added");
        router.push(`/gifting/${res.id}`);
      } else {
        await updateGiftItem(item!.id, formData);
        toast("Gift item updated");
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
      <Breadcrumbs items={[
        { label: "Gifting", href: "/gifting" },
        ...(mode === "edit" && item ? [{ label: item.title, href: `/gifting/${item.id}` }] : []),
        { label: mode === "create" ? "New Item" : "Edit" },
      ]} />

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
                maxLength={200}
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
                maxLength={500}
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
                maxLength={2000}
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
                maxLength={2000}
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
    </>
  );
}
