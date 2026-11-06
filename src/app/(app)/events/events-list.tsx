import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/badge";
import { MonthChip, SelectChip } from "@/components/filter-chip";
import { ListScrollArea, RowMenuHeading } from "@/components/list-page";
import { RowText } from "@/components/row-list";
import { formatMonth, formatRowDays, formatShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { monthOccurrence } from "@/lib/month-filter";
import { todayInMuse } from "@/lib/time-zone";
import { currentSession } from "@/server/auth";
import { type EventsFilters, type EventsTab, loaders } from "@/server/loaders";
import { EventMenu } from "./event-menu";
import { EventRow } from "./event-row";

const tabs: { tab: EventsTab; label: string }[] = [
  { tab: "upcoming", label: "Upcoming" },
  { tab: "past", label: "Past" },
  { tab: "cancelled", label: "Cancelled" },
];

// The default tab stays out of the URL.
const inURL = (tab: EventsTab) => (tab === "upcoming" ? undefined : tab);

// Tabs and chips live in the URL, so a filtered list can be shared or reloaded.
export async function EventsList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const tab = tabs.find((t) => t.tab === one("tab"))?.tab ?? "upcoming";
  const filters: EventsFilters = {
    tab,
    clientId: one("client"),
    month: one("month"),
  };
  const [{ clients, dates, counts, events }, session] = await Promise.all([loaders.events(filters), currentSession()]);
  const isAdmin = session?.user.role === "admin";
  // Every reload, as after any change, tells an open row to load its Lines again.
  // eslint-disable-next-line react-hooks/purity -- a Server Component renders once per request, after connection()
  const loadedAt = Date.now();
  const filtered = Boolean(filters.clientId || dates);

  const current = { tab: inURL(tab), client: filters.clientId, month: dates?.from.slice(0, 7), year: /^\d{4}$/.test(one("year") ?? "") ? one("year") : undefined };
  // The same filters with one thing changed; blanks stay out of the URL.
  const href = (change: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const values = { ...current, ...change };
    if ("tab" in change && current.month && !current.year) values.month = monthOccurrence(Number(current.month.slice(5)), todayInMuse(), change.tab === "past");
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value);
    const query = next.toString();
    return query ? `/events?${query}` : "/events";
  };
  // Where a row's Edit and Delete come back to: this list, filtered as it is.
  const back = href({});

  const months = byMonth(events);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SelectChip
          label="Client"
          anyLabel="All Clients"
          clearHref={href({ client: undefined })}
          options={clients.map((c) => ({
            label: c.name,
            href: href({ client: c.id }),
            selected: c.id === filters.clientId,
          }))}
        />
        <MonthChip
          key={`${current.tab ?? "upcoming"}:${current.year ?? "auto"}:${current.month ?? ""}`}
          chosen={dates && { month: dates.from.slice(0, 7), label: formatMonth(dates.from) }}
          action="/events"
          keep={{ tab: current.tab, client: current.client, year: current.year }}
          today={todayInMuse()}
          clearHref={href({ month: undefined, year: undefined })}
        />
      </div>
      <div className="-mx-4 mb-4 overflow-y-auto pr-4 [scrollbar-gutter:stable] rail:mx-0 rail:pr-8">
        <nav aria-label="Events by when" className="list-tabs flex gap-6 border-b border-line px-4 rail:px-0">
          {tabs.map((t) => (
            <Link
              key={t.tab}
              href={href({ tab: inURL(t.tab) })}
              aria-current={t.tab === tab ? "page" : undefined}
              className={cn(
                "-mb-px flex h-11 items-center gap-1.5 border-b-2 border-transparent font-medium text-subtle hover:text-foreground",
                t.tab === tab && "border-ink text-foreground",
              )}
            >
              {t.label}
              <span className="tabular-nums text-subtle">{counts[t.tab]}</span>
            </Link>
          ))}
        </nav>
      </div>
      <ListScrollArea label="Events list">
        {events.length === 0 ? (
          <p className="py-8 text-subtle">{filtered ? "Nothing matches these filters." : none[tab]}</p>
        ) : (
          <>
            {/* Desktop and tablet: one hairline table, each row striped with its Client's colour.
                Name uses the catalog's set width, then a fixed Dates with the Venue beneath.
                P&L takes the spare width so codes show in full, beside the fixed counts.
                Narrower tables fold P&L into Name; collapsed columns still count toward spans. */}
            <table className="hidden w-full min-w-[600px] table-fixed rail:table">
              <thead>
                <tr className="border-b border-line text-left text-[13px] text-subtle">
                  <th className="px-3 py-2 font-medium @min-[1000px]:w-60">Name</th>
                  <th className="w-44 px-3 py-2 font-medium">Dates</th>
                  <th className="px-3 py-2 font-medium @max-[900px]:invisible @max-[900px]:w-0 @max-[900px]:px-0">P&amp;L</th>
                  {/* The right padding clears the count's arrow, so the word lines up with the number. */}
                  <th className="w-28 py-2 pr-[34px] pl-3 text-right font-medium">Inventory</th>
                  <th className="w-28 py-2 pr-[34px] pl-3 text-right font-medium">Gifts</th>
                  <RowMenuHeading />
                </tr>
              </thead>
              {months.map(({ month, events }) => (
                <tbody key={month}>
                  <tr>
                    <th
                      colSpan={6}
                      scope="colgroup"
                      className="border-b border-line pt-5 pb-2 pl-3 text-left text-[13px] font-medium text-subtle"
                    >
                      {month}
                    </th>
                  </tr>
                  {events.map((e) => (
                    <EventRow
                      key={e.id}
                      event={{ id: e.id, name: e.name, colour: e.client.colour }}
                      isAdmin={isAdmin}
                      loadedAt={loadedAt}
                      cells={
                        <>
                          <td className="border-l-4 border-(--client-accent) py-2 pr-3 pl-3">
                            <Link href={`/events/${e.id}`} className="flex min-w-0 flex-col">
                              <RowText name={e.name} detail={<ClientLine event={e} />} />
                              {e.plCode && <span title={e.plCode} className="hidden truncate text-sm leading-6 text-subtle @max-[900px]:block">P&amp;L: {e.plCode}</span>}
                            </Link>
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex min-w-0 flex-col leading-6">
                              {rowDays(e) && <span className="whitespace-nowrap tabular-nums">{rowDays(e)}</span>}
                              {e.venue && <span title={e.venue} className="truncate text-[14px] text-subtle">{e.venue}</span>}
                            </span>
                          </td>
                          <td title={e.plCode ?? undefined} className="truncate px-3 py-2 text-subtle @max-[900px]:invisible @max-[900px]:px-0">{e.plCode}</td>
                        </>
                      }
                      lines={e.lines}
                      menu={<RowMenu event={e} isAdmin={isAdmin} back={back} />}
                    />
                  ))}
                </tbody>
              ))}
            </table>

            {/* Phone: full-width tappable rows, columns folded into a subtitle. */}
            <div className="-mx-4 rail:hidden">
              {months.map(({ month, events }) => (
                <section key={month}>
                  <h2 className="border-b border-line px-4 pt-5 pb-2 text-[13px] font-medium text-subtle">{month}</h2>
                  <ul>
                    {events.map((e) => (
                      <li
                        key={e.id}
                        className={`client-${e.client.colour} group/row relative flex min-h-16 items-center gap-3 border-b border-l-4 border-b-line border-l-(--client-accent) py-2 pr-4 pl-3 active:bg-row-hover`}
                      >
                        <Link
                          href={`/events/${e.id}`}
                          className="flex min-w-0 flex-1 flex-col after:absolute after:inset-0"
                        >
                          {/* The name keeps a line of its own; the Client, dates and badge share the next. */}
                          <RowText name={e.name} detail={
                            <span className="flex min-w-0 items-center gap-1.5">
                              <ClientName client={e.client} />
                              {rowDays(e) && <span className="shrink-0 whitespace-nowrap text-subtle tabular-nums">· {rowDays(e)}</span>}
                              <span className="ml-auto shrink-0 pl-1">
                                <EventBadges event={e} />
                              </span>
                            </span>
                          } />
                          {e.plCode && <span title={e.plCode} className="truncate text-sm leading-6 text-subtle">P&amp;L: {e.plCode}</span>}
                        </Link>
                        <span className="relative z-1">
                          <RowMenu event={e} isAdmin={isAdmin} back={back} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </ListScrollArea>
    </>
  );
}

type Listed = Awaited<ReturnType<typeof loaders.events>>["events"][number];

// A row's "⋯": the Event page's menu, coming back to this list.
function RowMenu({ event: e, isAdmin, back }: { event: Listed; isAdmin: boolean; back: string }) {
  return (
    <EventMenu
      event={{
        id: e.id,
        name: e.name,
        cancelled: e.cancelled,
        ended: e.ended,
        inHistory: e.inHistory,
        hasLines: e.lines.inventory + e.lines.gifts > 0,
      }}
      isAdmin={isAdmin}
      back={back}
    />
  );
}

// An Event without dates sits under "No dates", which says so already.
function rowDays(e: Listed) {
  return e.startsOn || e.endsOn ? formatRowDays(e.startsOn, e.endsOn) : null;
}

// The Client under an Event's name: plain text in its colour's ink.
function ClientName({ client, className }: { client: Listed["client"]; className?: string }) {
  return <span className={cn("min-w-0 truncate text-(color:--client-ink)", className)}>{client.name}</span>;
}

// The Client, with any badge at the line's end; a long name gives way to the badge.
function ClientLine({ event: e }: { event: Listed }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <ClientName client={e.client} />
      <span className="ml-auto shrink-0 pl-1">
        <EventBadges event={e} />
      </span>
    </span>
  );
}

// Its worst Shortage not yet acknowledged.
function EventBadges({ event: e }: { event: Listed }) {
  return e.shortBy !== null && <Badge>{formatShort(e.shortBy)}</Badge>;
}

// The loader's order keeps each month together: by the month of their first
// day (Upcoming ascending, Past and Cancelled descending), then Events still
// without dates.
function byMonth(events: Listed[]) {
  const months: { month: string; events: Listed[] }[] = [];
  for (const e of events) {
    const first = e.startsOn ?? e.endsOn;
    const month = first ? formatMonth(first) : "No dates";
    if (months.at(-1)?.month === month) months.at(-1)!.events.push(e);
    else months.push({ month, events: [e] });
  }
  return months;
}

const none: Record<EventsTab, string> = {
  upcoming: "No Upcoming Events.",
  past: "No Past Events.",
  cancelled: "No Cancelled Events.",
};

export function EventsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="mb-3 h-11 w-80 max-w-full rounded-full bg-fill" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 rounded-md bg-fill" />
      ))}
    </div>
  );
}
