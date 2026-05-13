"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type EventView = "upcoming" | "past";

export function EventViewSelect({ value }: { value: EventView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelect(nextView: EventView) {
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
    <div className="events-view-toggle" role="group" aria-label="Event view">
      <button
        type="button"
        className={`events-view-toggle-btn${value === "upcoming" ? " events-view-toggle-btn-active" : ""}`}
        onClick={() => handleSelect("upcoming")}
      >
        Upcoming
      </button>
      <button
        type="button"
        className={`events-view-toggle-btn${value === "past" ? " events-view-toggle-btn-active" : ""}`}
        onClick={() => handleSelect("past")}
      >
        Past
      </button>
    </div>
  );
}
