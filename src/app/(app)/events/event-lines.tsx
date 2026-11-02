import { formatDays } from "@/lib/format";
import type { EventLinesData } from "@/server/loaders";
import { Lines } from "./lines";

/** An Event's Inventory (with its Borrowed Items), then its Gifts. */
export function EventLines({ event, isAdmin }: { event: EventLinesData; isAdmin: boolean }) {
  return (
    <>
      <Lines
        kind="inventory"
        eventId={event.id}
        lines={event.inventory}
        shortages={event.shortages}
        isAdmin={isAdmin}
        reservable={event.reservable.inventory}
        cancelled={event.cancelled}
        dates={event.holdWindow && formatDays(event.holdWindow.from, event.holdWindow.to)}
      />
      <Lines
        kind="gift"
        eventId={event.id}
        lines={event.gifts}
        shortages={event.shortages}
        isAdmin={isAdmin}
        reservable={event.reservable.gifts}
        cancelled={event.cancelled}
      />
    </>
  );
}
