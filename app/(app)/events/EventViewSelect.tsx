"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type EventView = "upcoming" | "past";

export function EventViewSelect({ value }: { value: EventView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextView = event.target.value as EventView;
    const params = new URLSearchParams(searchParams.toString());

    if (nextView === "upcoming") {
      params.delete("view");
    } else {
      params.set("view", nextView);
    }

    params.delete("page");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <label className="events-view-select-label">
      <span className="sr-only">Event view</span>
      <select className="events-view-select" value={value} onChange={handleChange}>
        <option value="upcoming">Upcoming Events</option>
        <option value="past">Past Events</option>
      </select>
      <span className="events-view-select-chevron" aria-hidden="true" />
    </label>
  );
}
