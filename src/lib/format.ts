import { MUSE_TIME_ZONE, todayInMuse } from "./time-zone";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const wholeDollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** A Unit Price in cents as "$1,250.50", or "$1,250" with no cents; unknown is "$-". */
export function formatPrice(cents: number | null) {
  if (cents === null) return "$-";
  return (cents % 100 === 0 ? wholeDollars : dollars).format(cents / 100);
}

/** Cents back to what a person types in the Unit Price field. */
export function priceInput(cents: number | null) {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

const calendarDay = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** A calendar date ("2026-10-20") as "Oct 20, 2026", never shifted by a time zone (ADR 0005). */
export function formatDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return calendarDay.format(new Date(Date.UTC(year, month - 1, date)));
}

/** An Event's days: "Nov 10, 2026 – Nov 14, 2026", one day, or "No dates yet". */
export function formatDays(startsOn: string | null, endsOn: string | null) {
  if (!startsOn && !endsOn) return "No dates yet";
  if (!startsOn || !endsOn || startsOn === endsOn) return formatDay((startsOn ?? endsOn)!);
  return `${formatDay(startsOn)} – ${formatDay(endsOn)}`;
}

const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** A run of days in brief, as a chip reads it: "Nov 12 – Nov 14", or "Nov 12" for one day. */
export function formatShortDays(from: string, to: string) {
  const short = (day: string) => {
    const [year, month, date] = day.split("-").map(Number);
    return shortDay.format(new Date(Date.UTC(year, month - 1, date)));
  };
  return from === to ? short(from) : `${short(from)} – ${short(to)}`;
}

/**
 * An Event's days on its list row, where the month label above gives the
 * year: "Nov 12 – 14", "Nov 28 – Dec 2", one day, or "No dates yet".
 */
export function formatRowDays(startsOn: string | null, endsOn: string | null) {
  if (!startsOn && !endsOn) return "No dates yet";
  const from = (startsOn ?? endsOn)!;
  const to = (endsOn ?? startsOn)!;
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  if (from === to || !sameMonth) return formatShortDays(from, to);
  return `${formatShortDays(from, from)} – ${Number(to.slice(8))}`;
}

const calendarMonth = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** A calendar date's month: "2026-11-10" as "November 2026". */
export function formatMonth(day: string) {
  const [year, month] = day.split("-").map(Number);
  return calendarMonth.format(new Date(Date.UTC(year, month - 1, 1)));
}

const moment = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: MUSE_TIME_ZONE,
});

/** When something was recorded, in Muse's time zone. */
export function formatMoment(at: Date) {
  return moment.format(at);
}

const clockTime = new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: MUSE_TIME_ZONE });

/** The time of day something happened, in Muse's time zone: "3:42 PM". */
export function formatTime(at: Date) {
  return clockTime.format(at);
}

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const weekdayWithYear = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** A calendar day as a heading over what happened on it: "Today", "Yesterday", "Mon, Oct 26", or with its year if not this one. */
export function formatDayHeading(day: string, today: string) {
  const [year, month, date] = day.split("-").map(Number);
  const at = new Date(Date.UTC(year, month - 1, date));
  const [y, m, d] = today.split("-").map(Number);
  const daysAgo = Math.round((Date.UTC(y, m - 1, d) - at.getTime()) / 86_400_000);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return (year === y ? weekday : weekdayWithYear).format(at);
}

/** The day something happened, in Muse's time zone, to follow a word: "today", "yesterday", or "Oct 2, 2026". */
export function formatOn(at: Date, now = new Date()) {
  const day = todayInMuse(at);
  const [y, m, d] = todayInMuse(now).split("-").map(Number);
  const daysAgo = Math.round((Date.UTC(y, m - 1, d) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
  if (daysAgo === 0) return "today";
  if (daysAgo === 1) return "yesterday";
  return formatDay(day);
}

/** A Shortage as it reads on screen: "Short by 2". */
export function formatShort(shortBy: number) {
  return `Short by ${shortBy}`;
}

/** Why loaded gear didn't come back, as it reads on an old Write-off in History (ADR 0010). */
export const writeOffLabel = { lost: "Lost", damaged: "Damaged" } as const;
export type WriteOffReason = keyof typeof writeOffLabel;

/** "Count 24": its Stock across every Location. */
export function formatCount(count: number) {
  return `Count ${count}`;
}

/** Why an Adjustment changed Stock, as it reads on screen. */
export const reasonLabel = {
  purchased: "Purchased",
  found: "Found",
  lost: "Lost",
  damaged: "Damaged/written off",
  recount: "Recount",
  "given-away": "Given away",
} as const;
