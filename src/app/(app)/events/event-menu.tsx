"use client";

import { CalendarCheck, CalendarX, Pencil, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useActionState, useState } from "react";
import { FormActions, MainButton } from "@/components/button";
import { failsInline, FormError } from "@/components/form";
import { Confirm } from "@/components/confirm";
import { MenuContent, MenuItem, menuIcon, MoreTrigger } from "@/components/menu";
import { Sheet } from "@/components/sheet";
import { iconAction } from "@/components/icon-action";
import { cancelEvent, deleteEvent, reinstateEvent } from "./actions";

/**
 * An Event's "⋯" menu, on its page or its row in the list. From a row, `back`
 * is the list, where Edit and Delete return to.
 */
export function EventMenu({
  event,
  isAdmin,
  back,
}: {
  event: { id: string; name: string; cancelled: boolean; ended: boolean; inHistory: boolean; hasLines: boolean };
  isAdmin: boolean;
  back?: string;
}) {
  const [asking, setAsking] = useState<"cancel" | "reinstate" | "delete" | null>(null);
  const sheetProps = (which: NonNullable<typeof asking>) => ({
    open: asking === which,
    onOpenChange: (open: boolean) => setAsking(open ? which : null),
  });
  return (
    <>
      {!back ? <div className="flex flex-wrap gap-1">
        <Link href={`/events/${event.id}/edit`} aria-label="Edit" title="Edit" className={iconAction()}><Pencil size={20} aria-hidden /></Link>
        <button aria-label={event.cancelled ? "Reinstate event" : "Cancel event"} title={event.ended && !event.cancelled ? "Ended" : event.cancelled ? "Reinstate event" : "Cancel event"}
          disabled={!event.cancelled && event.ended} onClick={() => setAsking(event.cancelled ? "reinstate" : "cancel")} className={iconAction()}>
          {event.cancelled ? <CalendarCheck size={20} aria-hidden /> : <CalendarX size={20} aria-hidden />}
        </button>
        <button aria-label="Delete event" title={isAdmin ? "Delete event" : "Ask an Admin"} disabled={!isAdmin} onClick={() => setAsking("delete")} className={iconAction(true)}><Trash2 size={20} aria-hidden /></button>
      </div> : <DropdownMenu.Root>
        <MoreTrigger label={back ? `More for ${event.name}` : "More for this Event"} onRow={Boolean(back)} />
        <MenuContent align="end">
          <MenuItem asChild>
            <Link href={`/events/${event.id}/edit${back ? `?back=${encodeURIComponent(back)}` : ""}`}>
              <Pencil {...menuIcon} />
              Edit
            </Link>
          </MenuItem>
          {/* Everything the Event needs, on paper. */}
          {(
            <MenuItem asChild>
              <Link href={`/events/${event.id}/print`}>
                <Printer {...menuIcon} />
                Print list
              </Link>
            </MenuItem>
          )}
          {event.cancelled ? (
            <MenuItem onSelect={() => setAsking("reinstate")}>
              <CalendarCheck {...menuIcon} />
              Reinstate event
            </MenuItem>
          ) : (
            // Only before it ends.
            <MenuItem disabled={event.ended} hint={event.ended ? "Ended" : undefined} onSelect={() => setAsking("cancel")}>
              <CalendarX {...menuIcon} />
              Cancel event
            </MenuItem>
          )}
          {/* An Event in History stays on record, so it's never deleted. */}
          {(
            <MenuItem disabled={!isAdmin} hint={isAdmin ? undefined : "Ask an Admin"} onSelect={() => setAsking("delete")}>
              <Trash2 {...menuIcon} />
              Delete event
            </MenuItem>
          )}
        </MenuContent>
      </DropdownMenu.Root>}

      <Sheet {...sheetProps("cancel")} title="Cancel this Event?">
        <Confirm
          fields={{ id: event.id }}
          action={cancelEvent}
          onDone={() => setAsking(null)}
          explain="Its Reservations are released, so other Events can have what it holds. It moves to Cancelled, and reinstating it brings them back."
          button={{ icon: CalendarX, label: "Cancel event" }}
        />
      </Sheet>
      <Sheet {...sheetProps("reinstate")} title="Reinstate this Event?">
        <Confirm
          fields={{ id: event.id }}
          action={reinstateEvent}
          onDone={() => setAsking(null)}
          explain="Every Reservation it had comes back. If others have since taken what it held, it shows as Short."
          button={{ icon: CalendarCheck, label: "Reinstate event" }}
        />
      </Sheet>
      <Sheet {...sheetProps("delete")} title="Delete this Event?">
        <Confirm
          fields={{ id: event.id, ...(back && { back }) }}
          action={deleteEvent}
          onDone={() => setAsking(null)}
          explain={`${event.name} and its Lines are gone for good. This can't be undone.`}
          button={{ icon: Trash2, label: "Delete event" }}
        />
      </Sheet>
    </>
  );
}

/** A Cancelled Event's main button, bringing back every Reservation it had. */
export function ReinstateButton({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(failsInline(reinstateEvent), {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={eventId} />
      <FormActions>
        <MainButton icon={CalendarCheck} disabled={pending}>Reinstate event</MainButton>
      </FormActions>
      <FormError message={state.error} />
    </form>
  );
}
