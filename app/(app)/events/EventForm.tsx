"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { createEvent, updateEvent } from "./actions";
import Link from "next/link";

interface EventFormProps {
  mode: "create" | "edit";
  event?: {
    id: string;
    companyName: string;
    eventName: string;
    location: string;
    startDate: string;
    endDate: string;
    notes: string;
  };
}

export function EventForm({ mode, event }: EventFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [companyName, setCompanyName] = useState(event?.companyName ?? "");
  const [eventName, setEventName] = useState(event?.eventName ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startDate, setStartDate] = useState(event?.startDate ?? "");
  const [endDate, setEndDate] = useState(event?.endDate ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = { companyName, eventName, location, startDate, endDate, notes };

      if (mode === "create") {
        const res = await createEvent(formData);
        router.push(`/events/${res.id}`);
      } else {
        await updateEvent(event!.id, formData);
        router.push(`/events/${event!.id}`);
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
        <Link
          href={mode === "edit" ? `/events/${event?.id}` : "/events"}
          className="back-link"
        >
          ← Back
        </Link>
      </div>

      <PageHeader
        title={mode === "create" ? "Create Event" : `Edit "${event?.eventName}"`}
        subtitle={
          mode === "create"
            ? "Add a new event to the system"
            : "Update event details"
        }
      />

      <div className="form-container">
        <form onSubmit={handleSubmit} className="ev-form">
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Company Name *</label>
              <input
                type="text"
                className="form-input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="form-field">
              <label className="form-label">Event Name *</label>
              <input
                type="text"
                className="form-input"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
                placeholder="e.g. Annual Sales Kickoff"
              />
            </div>
            <div className="form-field form-field-wide">
              <label className="form-label">Location *</label>
              <input
                type="text"
                className="form-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                placeholder="e.g. Nashville, TN"
              />
            </div>
            <div className="form-field">
              <label className="form-label">Start Date *</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">End Date *</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate}
              />
            </div>
            <div className="form-field form-field-wide">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this event…"
              />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-footer">
            <Link
              href={mode === "edit" ? `/events/${event?.id}` : "/events"}
              className="btn btn-outline"
            >
              Cancel
            </Link>
            <button type="submit" className="btn btn-dark" disabled={loading}>
              {loading
                ? mode === "create"
                  ? "Creating…"
                  : "Saving…"
                : mode === "create"
                  ? "Create Event"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .back-link-wrap { margin-bottom: 16px; }
        .back-link { font-size: 14px; color: #6b7280; text-decoration: none; }
        .back-link:hover { color: #111827; }
        .form-container { max-width: 680px; }
        .ev-form { display: flex; flex-direction: column; gap: 24px; }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 24px;
        }
        .form-field { display: flex; flex-direction: column; gap: 4px; }
        .form-field-wide { grid-column: 1 / -1; }
        .form-label { font-size: 13px; font-weight: 500; color: #374151; }
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
        .form-footer { display: flex; justify-content: flex-end; gap: 8px; }
        .btn {
          display: inline-flex;
          align-items: center;
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
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-dark { background: #111827; color: white; }
        .btn-dark:hover:not(:disabled) { background: #1f2937; }
        .btn-outline {
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
        }
        .btn-outline:hover { background: #f3f4f6; }
      `}</style>
    </>
  );
}
