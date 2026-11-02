"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useActionState, useState } from "react";
import { AskAnAdmin } from "@/components/ask-an-admin";
import { FormActions, MainButton } from "@/components/button";
import { failsInline, FormError, TextArea } from "@/components/form";
import { Sheet } from "@/components/sheet";
import { EventThumb } from "@/components/thumb";
import { formatDays, formatMoment, formatShort } from "@/lib/format";
import { acknowledgeShortage, type LineFormState } from "./actions";

/** An Event's Shortage of one item, as its page shows it. */
export type EventShortage = {
  item: { id: string; name: string };
  shortBy: number;
  competing: {
    event: { id: string; name: string; startsOn: string | null; endsOn: string | null };
    reserved: number;
  }[];
  acknowledged: { shortBy: number; note: string; by: string; recordedAt: Date } | null;
  flagged: boolean;
};

/** Tapping Short lists the competing Events, where an Admin acknowledges it with a note. */
export function ShortageButton({
  eventId,
  shortage,
  isAdmin,
  label,
  className,
  children,
}: {
  eventId: string;
  shortage: EventShortage;
  isAdmin: boolean;
  /** What it's called, when its words alone don't say. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={label} className={className}>
        {children}
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={`${formatShort(shortage.shortBy)} · ${shortage.item.name}`}>
        <ShortageDetail eventId={eventId} shortage={shortage} isAdmin={isAdmin} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function ShortageDetail({
  eventId,
  shortage,
  isAdmin,
  onDone,
}: {
  eventId: string;
  shortage: EventShortage;
  isAdmin: boolean;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    failsInline(async (s: LineFormState, form: FormData) => {
      const result = await acknowledgeShortage(s, form);
      if (result.done) onDone();
      return result;
    }),
    {},
  );
  const { acknowledged } = shortage;
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Competing events</h3>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {shortage.competing.map(({ event, reserved }) => (
            <li key={event.id}>
              <Link href={`/events/${event.id}`} className="flex min-h-14 items-center gap-3 py-2 hover:bg-row-hover">
                <EventThumb />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{event.name}</span>
                  <span className="truncate text-[14px] text-subtle tabular-nums">
                    {formatDays(event.startsOn, event.endsOn)}
                  </span>
                </span>
                <span className="tabular-nums">{reserved} reserved</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {acknowledged && (
        <section className="flex flex-col gap-1">
          <p className="text-[14px] text-subtle">
            Acknowledged by {acknowledged.by} · {formatMoment(acknowledged.recordedAt)}
          </p>
          <p className="whitespace-pre-line">{acknowledged.note}</p>
          {shortage.flagged && (
            <p className="text-warning">It has changed since it was acknowledged.</p>
          )}
        </section>
      )}

      {shortage.flagged &&
        (isAdmin ? (
          <form action={formAction} className="flex flex-col gap-5">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="itemId" value={shortage.item.id} />
            <input type="hidden" name="shortBy" value={shortage.shortBy} />
            <TextArea
              label="How it will be covered"
              name="note"
              defaultValue={state.values?.note}
              placeholder="Borrowing 3 from the Hilton"
              required
            />
            <FormError message={state.error} />
            <FormActions>
              <MainButton icon={Check} disabled={pending}>Acknowledge</MainButton>
            </FormActions>
          </form>
        ) : (
          <FormActions>
            <AskAnAdmin look="main" icon={Check}>Acknowledge</AskAnAdmin>
          </FormActions>
        ))}
    </div>
  );
}
