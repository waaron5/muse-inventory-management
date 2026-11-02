import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Badge } from "@/components/badge";
import { EventThumb } from "@/components/thumb";
import { PageTitle } from "@/components/page-header";
import {
  formatCount,
  formatDay,
  formatDays,
  formatMoment,
  formatPrice,
  formatShort,
  reasonLabel,
  writeOffLabel,
  type WriteOffReason,
} from "@/lib/format";
import { currentSession } from "@/server/auth";
import { loaders } from "@/server/loaders";
import { archiveBlocked } from "./archive-blocked";
import { ItemMenu } from "./item-menu";
import type { Kind } from "./kind";
import { ItemPhoto, PastUsePhotos } from "./photos";
import { ReserveForEvent } from "./reserve-for-event";

type Entry = NonNullable<Awaited<ReturnType<typeof loaders.item>>>["history"][number];

// "Transfer · 5 from Warehouse to Garage", "Lost · −2 at Warehouse",
// "Given away · −7 from Warehouse for Gala", "Leftovers back · 2 to Warehouse for Gala".
// From before ADR 0010: "Load · 4 from Warehouse for Gala", "Load corrected · 2 back
// to Warehouse for Gala", "Return · 4 to Shed for Gala", "Return corrected · 1 back
// Out from Shed for Gala", "Written off, Lost · −1 for Gala", "Given away · −7 for Gala".
function describe(entry: Entry) {
  const forEvent = entry.event ? ` for ${entry.event.name}` : "";
  if (entry.kind === "given-away") {
    return { label: "Given away", change: `−${entry.count}`, where: `${entry.from ? ` from ${entry.from}` : ""}${forEvent}` };
  }
  if (entry.kind === "giveaway-correction") {
    return { label: "Leftovers back", change: `+${entry.count}`, where: ` to ${entry.to}${forEvent}` };
  }
  if (entry.kind === "load") return { label: "Load", change: String(entry.count), where: ` from ${entry.from}${forEvent}` };
  if (entry.kind === "load-correction") {
    return { label: "Load corrected", change: String(entry.count), where: ` back to ${entry.to}${forEvent}` };
  }
  if (entry.kind === "return") return { label: "Return", change: String(entry.count), where: ` to ${entry.to}${forEvent}` };
  if (entry.kind === "return-correction") {
    return { label: "Return corrected", change: String(entry.count), where: ` back Out from ${entry.from}${forEvent}` };
  }
  if (entry.kind === "write-off") {
    const reason = writeOffLabel[entry.reason as WriteOffReason];
    return { label: `Written off, ${reason}`, change: `−${entry.count}`, where: forEvent };
  }
  if (entry.kind === "adjustment" && entry.reason) {
    const sign = entry.to ? "+" : "−";
    return { label: reasonLabel[entry.reason], change: `${sign}${entry.count}`, where: ` at ${entry.to ?? entry.from}` };
  }
  const label = entry.kind === "transfer" ? "Transfer" : "Starting Stock";
  const where = [entry.from && ` from ${entry.from}`, entry.to && ` to ${entry.to}`].filter(Boolean).join("");
  return { label, change: String(entry.count), where };
}

/** An Inventory Item's or Gift's page, below its back link. */
export async function CatalogItem({ kind, params }: { kind: Kind; params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const [screen, session] = await Promise.all([
    (kind === "gift" ? loaders.gift : loaders.item)(id),
    currentSession(),
  ]);
  if (!screen) notFound();
  const { item, count, location, history, pastUses, wentTo, upcoming, reserveFor } = screen;
  const isAdmin = session?.user.role === "admin";

  return (
    <div className="flex flex-col gap-8">
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <ItemPhoto photo={item.photo} name={item.name} className="size-24 sm:size-32" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <PageTitle>{item.name}</PageTitle>
          <p className="text-subtle">
            {[item.sku, formatPrice(item.unitPriceCents)].filter(Boolean).join(" · ")}
          </p>
          {kind === "inventory" && <p className="text-subtle">Category: {item.categoryName ?? "Unassigned"}</p>}
          <p className="text-subtle">Location: {location?.name ?? "Unassigned"}</p>
          {item.archived && <Badge tone="plain" className="self-start">Archived</Badge>}
        </div>
        <div className="col-span-2 flex justify-end sm:col-span-1">
          <ItemMenu kind={kind} item={item} isAdmin={isAdmin} blocked={archiveBlocked(count, upcoming.length > 0)} />
        </div>
      </header>

      {item.description && <p className="whitespace-pre-line">{item.description}</p>}

      <section className="flex flex-col gap-1">
        <h2 className="font-heading text-[18px] leading-6 font-medium">{formatCount(count)}</h2>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col items-start gap-3">
          <h2 className="font-heading text-[18px] leading-6 font-medium">Upcoming events</h2>
          <ReserveForEvent itemId={item.id} events={reserveFor} />
        </div>
        {upcoming.length > 0 && (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {upcoming.map(({ event, reserved, shortBy }) => (
              <li key={event.id}>
                <Link href={`/events/${event.id}`} className="flex min-h-14 items-center gap-3 py-2 hover:bg-row-hover">
                  <EventThumb />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{event.name}</span>
                    <span className="truncate text-[14px] text-subtle tabular-nums">
                      {formatDays(event.startsOn, event.endsOn)}
                    </span>
                  </span>
                  {/* Stacked, so the Event's name keeps its room on a phone. */}
                  <span className="flex flex-col items-end gap-1">
                    <span className="tabular-nums">{reserved} reserved</span>
                    {shortBy !== null && <Badge>{formatShort(shortBy)}</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PastUsePhotos
        itemId={item.id}
        pastUses={pastUses}
        wentTo={wentTo}
        viewer={{ id: session?.user.id ?? "", isAdmin }}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-[18px] leading-6 font-medium">History</h2>
        {history.length > 0 && (
          <ol className="flex flex-col divide-y divide-line border-y border-line">
            {history.map((entry) => {
              const { label, change, where } = describe(entry);
              return (
                <li key={entry.id} className="flex flex-col gap-0.5 py-3">
                  <span>
                    <span className="font-medium">{label}</span>
                    {" · "}
                    <span className="tabular-nums">{change}</span>
                    {where}
                  </span>
                  {entry.note && <span className="whitespace-pre-line">{entry.note}</span>}
                  <span className="text-[14px] text-subtle">
                    {entry.by} · {formatDay(entry.happenedOn)} · recorded {formatMoment(entry.recordedAt)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

export function ItemSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <span className="size-24 rounded-md bg-fill sm:size-32" />
        <span className="h-8 w-64 rounded-md bg-fill" />
      </div>
      <div className="h-32 rounded-md bg-fill" />
    </div>
  );
}
