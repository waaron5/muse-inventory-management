import { Clock } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Avatar } from "@/components/avatar";
import { SelectChip } from "@/components/filter-chip";
import { ViewMoreLink } from "@/components/view-more";
import { type ActivityArea, activityAreaLabel, activityAreas } from "@/lib/activity";
import { formatDayHeading, formatTime } from "@/lib/format";
import { todayInMuse } from "@/lib/time-zone";
import { cn } from "@/lib/utils";
import { ACTIVITY_PAGE, type ActivityShown, loaders } from "@/server/loaders";
import { catalogs } from "../_catalog/kind";

// The most "View more" reaches, so a link can't ask for the whole record at once.
const MOST = 1000;

// The type tabs and the person chip live in the URL, so a filtered list can be
// shared or reloaded.
export async function ActivityList({
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
  const area = activityAreas.find((a) => a === one("type"));
  const person = one("person") || undefined;
  const asked = Number(one("show"));
  const show = Number.isInteger(asked) && asked > ACTIVITY_PAGE ? Math.min(asked, MOST) : ACTIVITY_PAGE;
  const { entries, more, people } = await loaders.activity({ area, person, show });

  const current = { type: area, person, show: show > ACTIVITY_PAGE ? String(show) : undefined };
  // The same filters with one thing changed; blanks stay out of the URL.
  const href = (change: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...current, ...change })) if (value) next.set(key, value);
    const query = next.toString();
    return query ? `/activity?${query}` : "/activity";
  };
  // A new filter starts from the newest again.
  const filter = (change: Record<string, string | undefined>) => href({ ...change, show: undefined });

  const today = todayInMuse();
  const days = byDay(entries);
  const tabs: { area?: ActivityArea; label: string }[] = [
    { label: "All" },
    ...activityAreas.map((a) => ({ area: a, label: activityAreaLabel[a] })),
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SelectChip
          label="Person"
          anyLabel="Everyone"
          clearHref={filter({ person: undefined })}
          options={people.map((p) => ({ label: p.name, href: filter({ person: p.id }), selected: p.id === person }))}
        />
      </div>
      <nav aria-label="Activity by type" className="list-tabs mb-2 flex gap-6 border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={filter({ type: t.area })}
            aria-current={t.area === area ? "page" : undefined}
            className={cn(
              "-mb-px flex h-11 shrink-0 items-center border-b-2 border-transparent font-medium text-subtle hover:text-foreground",
              t.area === area && "border-ink text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {entries.length === 0 ? (
        <p className="py-8 text-subtle">{area || person ? "Nothing matches these filters." : "Nothing yet."}</p>
      ) : (
        <>
          {days.map(([day, onDay]) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h2 id={`day-${day}`} className="pt-5 pb-1 text-[14px] font-medium text-subtle">
                {formatDayHeading(day, today)}
              </h2>
              <ul className="flex flex-col">
                {onDay.map((entry) => (
                  <li key={entry.id} className="flex min-h-14 items-center gap-3 border-b border-line py-3 last:border-b-0">
                    {entry.by ? (
                      <Avatar name={entry.by.name} colour={entry.by.colour} />
                    ) : (
                      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-subtle">
                        <Clock size={16} strokeWidth={1.75} />
                      </span>
                    )}
                    <p className="min-w-0 flex-1">
                      <span className="font-medium">{entry.by ? entry.by.name : "Automatic"}</span>{" "}
                      {entry.sentence.map((part, i) => <Part key={i} part={part} />)}
                    </p>
                    <time dateTime={entry.recordedAt.toISOString()} className="shrink-0 text-[14px] text-subtle tabular-nums">
                      {formatTime(entry.recordedAt)}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {more && show < MOST && (
            <ViewMoreLink href={href({ show: String(show + ACTIVITY_PAGE) })} scroll={false}>
              View more
            </ViewMoreLink>
          )}
        </>
      )}
    </>
  );
}

// A record's name; an Event or item still there links to its page.
function Part({ part }: { part: ActivityShown }) {
  if (typeof part === "string") return part;
  if (!part.live) return <span className="font-medium">{part.name}</span>;
  const path = part.ref === "event" ? "/events" : catalogs[part.itemKind ?? "inventory"].path;
  return (
    <Link href={`${path}/${part.id}`} className="font-medium underline-offset-4 hover:underline">
      {part.name}
    </Link>
  );
}

/** Entries under the day they happened in Muse, newest first as they came. */
function byDay<T extends { recordedAt: Date }>(entries: T[]) {
  const days = new Map<string, T[]>();
  for (const entry of entries) {
    const day = todayInMuse(entry.recordedAt);
    days.set(day, [...(days.get(day) ?? []), entry]);
  }
  return [...days];
}
