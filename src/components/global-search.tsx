"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { formatDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SearchResults } from "@/server/loaders";
import { floating } from "./menu";
import { SearchInput } from "./search-field";
import { Sheet } from "./sheet";
import { EventThumb, ItemThumb } from "./thumb";

const placeholder = "Search";

/**
 * One search across Events, Inventory and Gifts, at the right of every page's
 * TopRow from 800px. `/` or ⌘K focuses it, though nothing on screen says so.
 */
export function GlobalSearch() {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  useShortcut(input, () => {
    input.current?.focus();
    input.current?.select();
  });

  const close = () => {
    setOpen(false);
    input.current?.blur();
  };
  const search = useSearch(close);

  return (
    <div className="relative">
      <SearchInput
        ref={input}
        {...search.inputProps}
        aria-expanded={open && search.shown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {open && search.shown && (
        // Picking a result mustn't blur the field first, or the list would close under the pointer.
        <div className={cn(floating, "absolute top-full right-0 mt-1.5 max-h-[70dvh] w-[440px] max-w-[calc(100vw-2rem)] overflow-y-auto p-1")} onMouseDown={(e) => e.preventDefault()}>
          <Results search={search} />
        </div>
      )}
    </div>
  );
}

/** On phone, the top bar's search icon, opening search in a sheet. */
export function SearchButton() {
  const pathname = usePathname();
  if (!["/events", "/inventory", "/gifts"].includes(pathname)) return null;
  return <PhoneSearch />;
}

function PhoneSearch() {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useShortcut(button, () => setOpen(true));

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="mr-1 flex size-11 items-center justify-center rounded-md hover:bg-hover"
      >
        <Search size={20} strokeWidth={1.75} aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Search">
        <SheetSearch onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

// The sheet mounts this only while open, so each search starts blank.
function SheetSearch({ onDone }: { onDone: () => void }) {
  const search = useSearch(onDone);
  return (
    <div className="flex flex-col gap-3">
      <SearchInput {...search.inputProps} aria-expanded={search.shown} autoFocus />
      {search.shown && (
        <div className="-mx-2">
          <Results search={search} />
        </div>
      )}
    </div>
  );
}

const groups = [
  { key: "events", label: "Events" },
  { key: "inventory", label: "Inventory" },
  { key: "gifts", label: "Gifts" },
] as const;

type Option = { id: string; href: string; thumb: ReactNode; name: string; detail: string | null };

function optionsOf(results: SearchResults): Record<(typeof groups)[number]["key"], Option[]> {
  const item = (path: string) => (i: SearchResults["inventory"][number]): Option => ({
    id: i.id,
    href: `${path}/${i.id}`,
    thumb: <ItemThumb photo={i.photo} />,
    name: i.name,
    detail: i.sku,
  });
  return {
    events: results.events.map((e) => ({
      id: e.id,
      href: `/events/${e.id}`,
      thumb: <EventThumb />,
      name: e.name,
      detail: [e.clientName, formatDays(e.startsOn, e.endsOn), e.cancelled && "Cancelled"].filter(Boolean).join(" · "),
    })),
    inventory: results.inventory.map(item("/inventory")),
    gifts: results.gifts.map(item("/gifts")),
  };
}

type Search = ReturnType<typeof useSearch>;

// What's typed, the results for it as they arrive, and which one Enter opens.
// `onDone` closes the search, once a result is opened or on Escape.
function useSearch(onDone: () => void) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<{ term: string; results: SearchResults } | null>(null);
  const [active, setActive] = useState(0);
  const term = query.trim();

  useEffect(() => {
    if (!term) return;
    const request = new AbortController();
    // Wait for a pause in typing before asking.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: request.signal });
        if (response.ok) {
          setAnswer({ term, results: await response.json() });
          setActive(0);
        }
      } catch {
        // A newer search took over, or the network dropped; the last results stay.
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [term]);

  // While the next answer is on its way the last one stays on screen, but
  // Enter only opens a result for what's typed now.
  const options = term && answer ? optionsOf(answer.results) : null;
  const choices = options ? groups.flatMap((g) => options[g.key]) : [];
  const current = answer?.term === term;
  const optionId = (index: number) => `${listId}-${index}`;
  const pick = () => {
    setQuery("");
    setAnswer(null);
    onDone();
  };

  const inputProps = {
    value: query,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
    placeholder,
    autoComplete: "off",
    role: "combobox",
    "aria-controls": choices.length ? listId : undefined,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": choices[active] ? optionId(active) : undefined,
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (choices.length) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : choices.length - 1)) % choices.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!current || !choices[active]) return;
        router.push(choices[active].href);
        pick();
      } else if (e.key === "Escape") {
        onDone();
      }
    },
  };

  return { listId, options, choices, active, setActive, optionId, shown: Boolean(term), inputProps, pick };
}

function Results({ search }: { search: Search }) {
  const { listId, options, choices, active, setActive, optionId, pick } = search;
  if (!options) return <p className="px-3 py-2.5 text-subtle">Searching…</p>;
  if (choices.length === 0) return <p className="px-3 py-2.5 text-subtle">Nothing matches.</p>;

  let index = 0;
  return (
    <div id={listId} role="listbox" aria-label="Results">
      {groups.map(({ key, label }) =>
        options[key].length === 0 ? null : (
          <div key={key} role="group" aria-label={label}>
            <div aria-hidden className="px-3 pt-2 pb-1 text-[13px] font-medium text-subtle">
              {label}
            </div>
            {options[key].map((option) => {
              const i = index++;
              return (
                <Link
                  key={option.id}
                  id={optionId(i)}
                  href={option.href}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={pick}
                  className={cn("flex min-h-14 items-center gap-3 rounded-md px-2 py-2", i === active && "bg-hover")}
                >
                  {option.thumb}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{option.name}</span>
                    {option.detail && <span className="truncate text-[14px] text-subtle">{option.detail}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        ),
      )}
    </div>
  );
}

// `/` or ⌘K (Ctrl+K off a Mac) opens search from anywhere; `/` only when not
// typing, and neither over an open sheet or dialog. Every search on the page
// listens, and whichever is showing (`shown`) takes it.
function useShortcut(shown: RefObject<HTMLElement | null>, open: () => void) {
  const latest = useRef(open);
  useEffect(() => {
    latest.current = open;
  });
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]");
      const shortcut =
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") ||
        (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey);
      if (!shortcut || !shown.current?.checkVisibility()) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      e.preventDefault();
      latest.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shown]);
}
