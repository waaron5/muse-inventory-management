"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";
import { ButtonLink, FormActions, MainButton } from "@/components/button";
import { failsInline, Field, FormError, TextArea } from "@/components/form";
import type { EventFormState } from "./actions";

export type EventValues = {
  id: string;
  name: string;
  client: string;
  plCode: string;
  venue: string;
  startsOn: string;
  endsOn: string;
  notes: string;
};

/**
 * Anyone's form for an Event. The Client is typed: a name already there is
 * that Client, a new one is added.
 */
export function EventForm({
  action,
  event,
  clients,
  cancelHref,
  back,
}: {
  action: (state: EventFormState, form: FormData) => Promise<EventFormState>;
  event?: EventValues;
  clients: { name: string }[];
  cancelHref: string;
  /** Where saving returns to, when not the page itself. */
  back?: string;
}) {
  const [state, formAction, pending] = useActionState(failsInline(action), {});
  const typed = (key: keyof EventValues) => state.values?.[key] ?? event?.[key] ?? "";
  return (
    <form action={formAction} className="flex max-w-[560px] flex-col gap-5">
      {event && <input type="hidden" name="id" value={event.id} />}
      {back && <input type="hidden" name="back" value={back} />}
      <Field label="Event Name" name="name" defaultValue={typed("name")} required autoFocus={!event} />
      <Field
        label="Client"
        name="client"
        list="clients"
        defaultValue={typed("client")}
        required
        autoComplete="off"
      />
      <datalist id="clients">
        {clients.map((c) => (
          <option key={c.name} value={c.name} />
        ))}
      </datalist>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="P&L Code" name="plCode" defaultValue={typed("plCode")} autoComplete="off" />
        <Field label="Venue" name="venue" defaultValue={typed("venue")} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Start date" name="startsOn" type="date" defaultValue={typed("startsOn")} />
        <Field label="End date" name="endsOn" type="date" defaultValue={typed("endsOn")} />
      </div>
      <TextArea label="Notes" name="notes" defaultValue={typed("notes")} />
      <FormError message={state.error} />
      <FormActions>
        <ButtonLink look="plain" href={cancelHref}>
          Cancel
        </ButtonLink>
        <MainButton icon={Check} disabled={pending}>
          {event ? "Save" : "Add Event"}
        </MainButton>
      </FormActions>
    </form>
  );
}
