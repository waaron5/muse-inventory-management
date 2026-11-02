"use client";

import { CalendarPlus } from "lucide-react";
import { useActionState, useState } from "react";
import { FormActions, MainButton } from "@/components/button";
import { failsInline, FormError, Select } from "@/components/form";
import { Sheet } from "@/components/sheet";
import { formatDays } from "@/lib/format";
import { type LineFormState, reserve } from "../events/actions";
import { Available, ReserveCount } from "../events/reserve-count";

type Candidate = { id: string; name: string; startsOn: string | null; endsOn: string | null; available: number | null };

/** Reserve for an event… on an item's page: pick an Upcoming Event, then how many. */
export function ReserveForEvent({ itemId, events }: { itemId: string; events: Candidate[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MainButton icon={CalendarPlus} onClick={() => setOpen(true)} disabled={events.length === 0}>
        Reserve for an event
      </MainButton>
      <Sheet open={open} onOpenChange={setOpen} title="Reserve for an event">
        <ReserveForm itemId={itemId} events={events} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function ReserveForm({ itemId, events, onDone }: { itemId: string; events: Candidate[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    failsInline(async (s: LineFormState, form: FormData) => {
      const result = await reserve(s, form);
      if (result.done) onDone();
      return result;
    }),
    {},
  );
  const [eventId, setEventId] = useState(state.values?.eventId ?? "");
  const chosen = events.find((e) => e.id === eventId);
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="itemId" value={itemId} />
      <Select label="Event" name="eventId" value={eventId} onChange={(e) => setEventId(e.target.value)} required>
        <option value="" disabled>
          Pick an Event
        </option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} · {formatDays(e.startsOn, e.endsOn)}
          </option>
        ))}
      </Select>
      {chosen?.available != null && <Available available={chosen.available} className="-mt-3" />}
      <ReserveCount
        key={chosen?.id}
        available={chosen?.available ?? null}
        typed={state.values?.count}
        autoFocus={Boolean(chosen)}
      />
      <FormError message={state.error} />
      <FormActions>
        <MainButton icon={CalendarPlus} disabled={pending}>
          Reserve
        </MainButton>
      </FormActions>
    </form>
  );
}
