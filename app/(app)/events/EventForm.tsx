"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useSetTopBar } from "@/components/TopBarContext";
import { createEvent, updateEvent } from "./actions";
import Link from "next/link";

interface EventFormProps {
  mode: "create" | "edit";
  event?: {
    id: string;
    companyName: string;
    eventName: string;
    plCode: string;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    notes: string;
  };
}

export function EventForm({ mode, event }: EventFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [companyName, setCompanyName] = useState(event?.companyName ?? "");
  const [eventName, setEventName] = useState(event?.eventName ?? "");
  const [plCode, setPlCode] = useState(event?.plCode ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startDate, setStartDate] = useState(event?.startDate ?? "");
  const [endDate, setEndDate] = useState(event?.endDate ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");

  const titleNode = useMemo(
    () => (
      <ol className="bc-list" aria-label="Breadcrumb">
        <li className="bc-item">
          <Link href="/events" className="bc-link">
            Events
          </Link>
        </li>
        {mode === "edit" && event && (
          <li className="bc-item">
            <span className="bc-sep" aria-hidden="true">
              /
            </span>
            <Link href={`/events/${event.id}`} className="bc-link">
              {event.eventName}
            </Link>
          </li>
        )}
        <li className="bc-item">
          <span className="bc-sep" aria-hidden="true">
            /
          </span>
          <span className="bc-current">{mode === "create" ? "New Event" : "Edit"}</span>
        </li>
      </ol>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, event?.id],
  );

  const actionsNode = useMemo(
    () => (
      <>
        <Link href="/events" className="btn btn-outline">
          Cancel
        </Link>
        <button type="submit" form="event-form" className="btn btn-dark" disabled={loading}>
          {loading
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create Event"
              : "Save Changes"}
        </button>
      </>
    ),

    [loading, mode],
  );

  useSetTopBar(titleNode, actionsNode);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = { companyName, eventName, plCode, location, startDate, endDate, notes };

      if (mode === "create") {
        await createEvent(formData);
        toast("Event created");
        router.push("/events");
      } else {
        await updateEvent(event!.id, formData);
        toast("Event updated");
        router.push("/events");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-container">
      <form id="event-form" onSubmit={handleSubmit} className="ev-form">
        <div className="form-grid">
          <div className="form-field">
            <label className="form-label">Client Name *</label>
            <input
              type="text"
              className="form-input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              maxLength={200}
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
              maxLength={200}
              placeholder="e.g. Annual Sales Kickoff"
            />
          </div>
          <div className="form-field">
            <label className="form-label">P &amp; L</label>
            <input
              type="text"
              className="form-input"
              value={plCode}
              onChange={(e) => setPlCode(e.target.value)}
              maxLength={80}
              placeholder="e.g. PL-24017"
            />
          </div>
          <div className="form-field form-field-wide">
            <label className="form-label">Location</label>
            <input
              type="text"
              className="form-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={200}
              placeholder="e.g. Nashville, TN"
            />
          </div>
          <div className="form-field">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
              maxLength={2000}
              placeholder="Any additional notes about this event…"
            />
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
      </form>
    </div>
  );
}
