"use client";

import { type ReactNode, useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SecondaryButton } from "@/components/button";
import { FormError, inlineFailure } from "@/components/form";
import { LinkedRow } from "@/components/linked-row";
import { RowMenuCell } from "@/components/list-page";
import type { EventLinesData } from "@/server/loaders";
import { EventLines } from "./event-lines";

/**
 * An Events table row whose Inventory and Gifts counts each open the same
 * full-width panel under it: the Event's Inventory and Gifts, editable as on
 * its page. An Event with no Lines still opens it, to add some. Several can be
 * open at once; which ones isn't kept anywhere, not even the URL.
 */
export function EventRow({
  event,
  isAdmin,
  loadedAt,
  cells,
  lines,
  menu,
}: {
  event: { id: string; name: string; colour: string };
  isAdmin: boolean;
  /** When the list was loaded: each reload, as after any change, loads an open panel's Lines again. */
  loadedAt: number;
  /** The cells before its counts. */
  cells: ReactNode;
  /** Its Lines counted. */
  lines: { inventory: number; gifts: number };
  /** The row's "⋯". */
  menu: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const opener = (label: string, count: number) => (
    <td className="p-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="flex min-h-16 w-full items-center justify-end gap-1.5 px-3 py-1 tabular-nums hover:underline"
      >
        {/* The row's name says whose; repeating it here would read the name twice. */}
        <span className="sr-only">{label}: </span>
        <span className={count === 0 ? "text-subtle" : undefined}>{count}</span>
        <ChevronDown size={16} aria-hidden className={open ? "shrink-0 rotate-180" : "shrink-0"} />
      </button>
    </td>
  );
  return (
    <>
      <LinkedRow href={`/events/${event.id}`} className={`client-${event.colour} group/row h-16 border-b border-line hover:bg-row-hover`}>
        {cells}
        {opener("Inventory", lines.inventory)}
        {opener("Gifts", lines.gifts)}
        <RowMenuCell>{menu}</RowMenuCell>
      </LinkedRow>
      {open && (
        <tr className={`client-${event.colour} border-b border-line`}>
          <td colSpan={6} className="border-l-4 border-(--client-accent) p-0">
            <section
              id={panelId}
              aria-label={`Lines of ${event.name}`}
              className="grid gap-8 py-5 pr-3 pl-4 xl:grid-cols-2"
            >
              <Panel eventId={event.id} isAdmin={isAdmin} loadedAt={loadedAt} />
            </section>
          </td>
        </tr>
      )}
    </>
  );
}

// Loaded when opened, so the list itself stays within its round trips.
function Panel({ eventId, isAdmin, loadedAt }: { eventId: string; isAdmin: boolean; loadedAt: number }) {
  const [lines, setLines] = useState<EventLinesData | null>(null);
  const [failure, setFailure] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/lines`, { signal: request.signal });
        if (!response.ok) throw new Error(`Loading an Event's Lines answered ${response.status}`);
        setLines(revived(await response.json()));
        setFailure(undefined);
      } catch (error) {
        // A newer load took over, or it failed: what's showing stays, with a way to try again.
        if (!request.signal.aborted) setFailure(inlineFailure(error));
      }
    })();
    return () => request.abort();
  }, [eventId, loadedAt, attempt]);

  return (
    <>
      {failure && (
        <div className="flex flex-wrap items-center gap-3 xl:col-span-2">
          <FormError message={failure} />
          <SecondaryButton type="button" onClick={() => setAttempt(attempt + 1)}>
            Try again
          </SecondaryButton>
        </div>
      )}
      {lines ? (
        <EventLines event={lines} isAdmin={isAdmin} />
      ) : (
        !failure && [0, 1].map((i) => <div key={i} aria-hidden className="h-28 rounded-md bg-fill" />)
      )}
    </>
  );
}

// JSON leaves an acknowledgement's moment a string.
function revived(json: EventLinesData): EventLinesData {
  return {
    ...json,
    shortages: json.shortages.map((s) => ({
      ...s,
      acknowledged: s.acknowledged && { ...s.acknowledged, recordedAt: new Date(s.acknowledged.recordedAt) },
    })),
  };
}
