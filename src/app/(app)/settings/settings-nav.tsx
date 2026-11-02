"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import { Building2, MapPin, Shapes, UserRound, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

const sections = [
  { id: "my-profile", label: "My profile", Icon: UserRound },
  { id: "users", label: "Users", Icon: UsersRound },
  { id: "clients", label: "Clients", Icon: Building2 },
  { id: "locations", label: "Locations", Icon: MapPin },
  { id: "categories", label: "Categories", Icon: Shapes },
];

// The scroll's length, and how far below the top of the window a card stops
// (main's top padding), so its border isn't cut.
const DURATION = 320;
const INSET = 20;
// Someone scrolling themselves takes over from the menu.
const interactions = ["pointerdown", "keydown", "wheel", "touchmove"];

/**
 * Settings' cards in a menu beside them, from 1024px: a link scrolls quickly
 * to its card, and the card in view is marked as the current one.
 */
export function SettingsNav() {
  const [current, setCurrent] = useState(sections[0].id);
  // While a link's scroll runs, and until someone scrolls themselves, the
  // link they chose stays current, even for a card too low to reach the top.
  const chosen = useRef<string | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    const spy = () => {
      if (chosen.current) return;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let inView = sections[0].id;
      for (const { id } of sections) {
        const card = document.getElementById(id);
        // React streams cards in hidden, where they measure as at the top.
        if (!card?.getClientRects().length) continue;
        if (atEnd || card.getBoundingClientRect().top <= window.innerHeight / 3) inView = id;
      }
      setCurrent(inView);
    };
    const release = () => {
      cancelAnimationFrame(frame.current);
      chosen.current = null;
    };
    window.addEventListener("scroll", spy, { passive: true });
    for (const type of interactions) window.addEventListener(type, release, { capture: true, passive: true });
    spy();
    return () => {
      release();
      window.removeEventListener("scroll", spy);
      for (const type of interactions) window.removeEventListener(type, release, { capture: true });
    };
  }, []);

  const go = (event: MouseEvent, id: string) => {
    // A new tab gets the browser's own handling.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    chosen.current = id;
    setCurrent(id);
    history.replaceState(history.state, "", `#${id}`);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => scrollTo(id));
  };

  // A card still streaming in is hidden, where it measures as at the top, so
  // the scroll waits a frame at a time for it to land.
  const scrollTo = (id: string) => {
    const card = document.getElementById(id);
    if (!card?.getClientRects().length) {
      frame.current = requestAnimationFrame(() => scrollTo(id));
      return;
    }
    card.querySelector("h2")?.focus({ preventScroll: true });
    const from = window.scrollY;
    const end = document.documentElement.scrollHeight - window.innerHeight;
    const to = Math.max(0, Math.min(end, card.getBoundingClientRect().top + from - INSET));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, to);
      return;
    }
    let start: number | undefined;
    const step = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / DURATION);
      // Quick to leave and gentle to land: ease-out quart.
      window.scrollTo(0, from + (to - from) * (1 - (1 - t) ** 4));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };

  // From 1024px, the heading and menu stay together: 20px main inset + 68px
  // TopRow puts the heading at 88px; its 62px height puts the menu at 150px.
  return (
    <div>
      <div className="lg:fixed lg:top-[88px] lg:w-40">
        <PageHeader title="Settings" />
        <nav aria-label="Settings" className="hidden max-h-[calc(100dvh-170px)] overflow-y-auto lg:block">
          <ul className="flex flex-col gap-1">
            {sections.map(({ id, label, Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  onClick={(event) => go(event, id)}
                  aria-current={current === id ? "location" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-[15px] leading-6 text-ink hover:bg-hover",
                    current === id && "bg-selected font-medium hover:bg-selected",
                  )}
                >
                    <Icon size={20} strokeWidth={1.75} aria-hidden className={cn("shrink-0", current === id ? "text-ink" : "text-subtle")} />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
