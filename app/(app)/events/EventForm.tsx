"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useToast } from "@/components/Toast";
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
  const { toast } = useToast();
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
        toast("Event created");
        router.push(`/events/${res.id}`);
      } else {
        await updateEvent(event!.id, formData);
        toast("Event updated");
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
      <Breadcrumbs items={[
        { label: "Events", href: "/events" },
        ...(mode === "edit" && event ? [{ label: event.eventName, href: `/events/${event.id}` }] : []),
        { label: mode === "create" ? "New Event" : "Edit" },
      ]} />

      <PageHeader
        title={
          mode === "create" ? (
            "Create Event"
          ) : (
            <>
              Edit "<span className="event-name-inline">{event?.eventName}</span>"
            </>
          )
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
            <div className="form-field form-field-wide">
              <label className="form-label">Location *</label>
              <input
                type="text"
                className="form-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                maxLength={200}
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
                maxLength={2000}
                placeholder="Any additional notes about this event…"
              />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-footer page-form-footer">
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
    </>
  );
}
