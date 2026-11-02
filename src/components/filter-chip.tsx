"use client";

import { Check, ChevronDown, X } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { DropdownMenu, Popover } from "radix-ui";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { SecondaryButton } from "./button";
import { Field, Select } from "./form";
import { monthOccurrence } from "@/lib/month-filter";
import { floating, MenuContent, MenuItem } from "./menu";

// Filter chips, as in Dropbox: light grey at rest, darker when on. Each
// choice is a link, so the filters live in the URL.

const chip = "flex h-11 items-center rounded-full text-[15px]";
const look = (on: boolean) => (on ? "bg-selected font-medium" : "bg-fill hover:bg-hover");

/** A chip that's on or off, like Archived. */
export function ToggleChip({ href, on, children }: { href: string; on: boolean; children: string }) {
  return (
    <Link href={href} aria-pressed={on} className={cn(chip, "px-4", look(on))}>
      {children}
    </Link>
  );
}

export type ChipOption = { label: string; href: string; selected: boolean };

/**
 * A chip that picks one of several, like a Client. Unset it reads "Client";
 * set it reads "Client: Acme", with an × to clear it.
 */
export function SelectChip({
  label,
  anyLabel,
  options,
  clearHref,
}: {
  label: string;
  anyLabel: string;
  options: ChipOption[];
  clearHref: string;
}) {
  const chosen = options.find((o) => o.selected);
  return (
    <span className={cn(chip, look(Boolean(chosen)))}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={chosen ? `${label}: ${chosen.label}` : label}
          className={cn("flex h-full items-center gap-1.5 rounded-full pl-4", chosen ? "pr-1" : "pr-3")}
        >
          <span className="max-w-[16ch] truncate">{chosen ? `${label}: ${chosen.label}` : label}</span>
          {!chosen && <ChevronDown size={16} strokeWidth={1.75} aria-hidden />}
        </DropdownMenu.Trigger>
        <MenuContent align="start">
          <ChipItem label={anyLabel} href={clearHref} selected={!chosen} />
          {options.map((o) => (
            <ChipItem key={o.href} {...o} />
          ))}
        </MenuContent>
      </DropdownMenu.Root>
      {chosen && (
        <Link
          href={clearHref}
          aria-label={`Clear ${label}`}
          className="mr-1 flex size-9 items-center justify-center rounded-full text-subtle hover:text-ink"
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </Link>
      )}
    </span>
  );
}

function ChipItem({ label, href, selected }: ChipOption) {
  return (
    <MenuItem asChild selected={selected}>
      <Link href={href}>
        <span className="flex size-4 shrink-0 items-center justify-center">
          {selected && <Check size={16} strokeWidth={1.75} aria-hidden />}
        </span>
        <span className="truncate">{label}</span>
      </Link>
    </MenuItem>
  );
}

/**
 * A chip that picks a run of days, like "available for these dates". Unset it
 * reads "Available"; set it reads "Available: Nov 12 – Nov 14", with an × to
 * clear it. The days go in the URL as `from` and `to`, beside what's set in `keep`.
 */
export function DatesChip({
  label,
  chosen,
  action,
  keep,
  clearHref,
}: {
  label: string;
  chosen: { from: string; to: string; label: string } | null;
  action: string;
  keep: Record<string, string | undefined>;
  clearHref: string;
}) {
  return (
    <FilterFormChip label={label} chosen={chosen} action={action} keep={keep} clearHref={clearHref}>
      <Field label="From" name="from" type="date" defaultValue={chosen?.from} required />
      <Field label="To" name="to" type="date" defaultValue={chosen?.to} />
    </FilterFormChip>
  );
}

/** A calendar month and year, stored in the URL as `month=YYYY-MM`. */
export function MonthChip({
  chosen,
  action,
  keep,
  clearHref,
  today,
}: {
  chosen: { month: string; label: string } | null;
  action: string;
  keep: Record<string, string | undefined>;
  clearHref: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(keep.year ?? "");
  const currentYear = Number(today.slice(0, 4));
  const monthHref = (month: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(keep)) if (value && key !== "year") query.set(key, value);
    query.set("month", year ? `${year}-${String(month).padStart(2, "0")}` : monthOccurrence(month, today, keep.tab === "past"));
    if (year) query.set("year", year);
    return `${action}?${query}`;
  };
  return (
    <span className={cn(chip, look(Boolean(chosen)))}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger aria-label={chosen ? `Month: ${chosen.label}` : "Month"} className="flex h-full items-center gap-1.5 px-4">
          {chosen ? `Month: ${chosen.label}` : "Month"}<ChevronDown size={16} aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} collisionPadding={8} className={cn(floating, "max-h-[70dvh] w-64 overflow-y-auto p-2")}>
            <div className="p-2"><Select label="Year" value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="">{keep.tab === "past" ? "Most recent" : "Current or next"}</option>
              {Array.from({ length: 21 }, (_, index) => currentYear - 10 + index).map((value) => <option key={value} value={value}>{value}</option>)}
            </Select></div>
            {Array.from({ length: 12 }, (_, index) => {
              const month = index + 1;
              const label = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1)));
              return <Link key={month} href={monthHref(month)} onClick={() => setOpen(false)}
                className={cn("flex min-h-10 items-center rounded-md px-3 hover:bg-hover", Number(chosen?.month.slice(5)) === month && "bg-selected font-medium")}>
                {label}
              </Link>;
            })}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {chosen && <Link href={clearHref} aria-label="Clear Month" className="mr-1 flex size-9 items-center justify-center rounded-full text-subtle hover:text-ink"><X size={16} aria-hidden /></Link>}
    </span>
  );
}

function FilterFormChip({
  label,
  chosen,
  action,
  keep,
  clearHref,
  children,
}: {
  label: string;
  chosen: { label: string } | null;
  action: string;
  keep: Record<string, string | undefined>;
  clearHref: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className={cn(chip, look(Boolean(chosen)))}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          aria-label={chosen ? `${label}: ${chosen.label}` : label}
          className={cn("flex h-full items-center gap-1.5 rounded-full pl-4", chosen ? "pr-1" : "pr-3")}
        >
          <span className="whitespace-nowrap">{chosen ? `${label}: ${chosen.label}` : label}</span>
          {!chosen && <ChevronDown size={16} strokeWidth={1.75} aria-hidden />}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={8}
            className={cn(floating, "w-[280px] p-4")}
          >
            <Form action={action} onSubmit={() => setOpen(false)} className="flex flex-col gap-4">
              {Object.entries(keep).map(
                ([key, value]) => value && <input key={key} type="hidden" name={key} value={value} />,
              )}
              {children}
              <SecondaryButton type="submit">Confirm</SecondaryButton>
            </Form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {chosen && (
        <Link
          href={clearHref}
          aria-label={`Clear ${label}`}
          className="mr-1 flex size-9 items-center justify-center rounded-full text-subtle hover:text-ink"
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </Link>
      )}
    </span>
  );
}
