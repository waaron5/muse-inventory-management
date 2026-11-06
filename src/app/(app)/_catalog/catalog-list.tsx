import Link from "next/link";
import { RowText } from "@/components/row-list";
import { connection } from "next/server";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/badge";
import { DatesChip, SelectChip, ToggleChip } from "@/components/filter-chip";
import { LinkedRow } from "@/components/linked-row";
import { ListScrollArea, RowMenuCell, RowMenuHeading } from "@/components/list-page";
import { formatPrice, formatShort, formatShortDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import { currentSession } from "@/server/auth";
import { type InventoryFilters, loaders } from "@/server/loaders";
import { archiveBlocked } from "./archive-blocked";
import { ItemMenu } from "./item-menu";
import { catalogs, type Kind } from "./kind";
import { ItemPhoto } from "./photos";

// Filters live in the URL, so a filtered list can be shared or reloaded.
export async function CatalogList({
  kind,
  searchParams,
}: {
  kind: Kind;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { path, none } = catalogs[kind];
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const filters: InventoryFilters = {
    ...(kind === "inventory" && { categoryId: one("category") }),
    locationId: one("location"),
    archived: one("archived") === "1",
    // Only Inventory Items are held across dates.
    ...(kind === "inventory" && { availableFrom: one("from"), availableTo: one("to") }),
  };
  const [{ locations, categories, items, availableFor }, session] = await Promise.all([
    (kind === "gift" ? loaders.gifts : loaders.inventory)(filters),
    currentSession(),
  ]);
  const isAdmin = session?.user.role === "admin";
  const sort = sorts.find((s) => s === one("sort"));
  const sorted = sort ? [...items].sort(byColumn(sort)) : items;
  const filtered = Boolean(filters.categoryId || filters.locationId || filters.archived || availableFor);

  // The same filters with one thing changed; blanks stay out of the URL.
  const current = {
    category: filters.categoryId,
    location: filters.locationId,
    archived: one("archived"),
    from: availableFor?.from,
    to: availableFor?.to,
    sort,
  };
  const href = (change: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...current, ...change })) if (value) next.set(key, value);
    const query = next.toString();
    return query ? `${path}?${query}` : path;
  };
  // Where a row's Edit comes back to: this list, filtered as it is.
  const back = href({});

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {kind === "inventory" && <SelectChip
          label="Category"
          anyLabel="All Categories"
          clearHref={href({ category: undefined })}
          options={[
            ...categories.map((category) => ({ label: category.name, href: href({ category: category.id }), selected: category.id === filters.categoryId })),
            { label: "Unassigned", href: href({ category: "unassigned" }), selected: filters.categoryId === "unassigned" },
          ]}
        />}
        <SelectChip
          label="Location"
          anyLabel="All Locations"
          clearHref={href({ location: undefined })}
          options={locations.map((l) => ({
            label: l.name,
            href: href({ location: l.id }),
            selected: l.id === filters.locationId,
          }))}
        />
        {kind === "inventory" && (
          <DatesChip
            label="Available"
            chosen={availableFor && { ...availableFor, label: formatShortDays(availableFor.from, availableFor.to) }}
            action={path}
            keep={{ category: current.category, location: current.location, archived: current.archived, sort }}
            clearHref={href({ from: undefined, to: undefined })}
          />
        )}
        <ToggleChip href={href({ archived: filters.archived ? undefined : "1" })} on={filters.archived ?? false}>
          Archived
        </ToggleChip>
      </div>
      <ListScrollArea label={`${kind === "gift" ? "Gifts" : "Inventory"} list`}>
        {items.length === 0 ? (
          <p className="py-8 text-subtle">
            {filtered ? "Nothing matches these filters." : none}
          </p>
        ) : (
          <>
            {/* Details takes the spare width beside a Name of set width, so a wide
                screen doesn't push the two apart; each Name is as wide as it is on a
                1400px screen. The numbers sit together by the menu. As the list
                narrows, Details gives way and Name takes its place, then Unit Price
                goes, then a Gift's Reserved. */}
            <table className="hidden w-full min-w-[600px] table-fixed rail:table">
              <thead>
                <tr className="border-b border-line text-left text-[13px] text-subtle">
                  <th className="w-[72px] px-3 py-2">
                    <span className="sr-only">Photo</span>
                  </th>
                  <SortHeading label="Name" by="name" sort={sort} href={href} className={kind === "gift" ? "@min-[1000px]:w-48" : "@min-[1000px]:w-60"} />
                  <th className="px-3 py-2 font-medium @max-[1000px]:hidden">Details</th>
                  <th className="w-36 px-3 py-2 font-medium">Location</th>
                  <SortHeading label="Unit Price" by="price" sort={sort} href={href} className="w-24 @max-[760px]:hidden" />
                  <SortHeading label="Count" by="count" sort={sort} href={href} className="w-20" />
                  {availableFor && <th className="w-24 px-3 py-2 text-right font-medium">Available</th>}
                  {kind === "inventory" && !availableFor && <th className="w-32 px-3 py-2 font-medium">Next reserved</th>}
                  {kind === "gift" && <th className="w-24 px-3 py-2 text-right font-medium @max-[700px]:hidden">Reserved</th>}
                  {kind === "gift" && <th className="w-30 px-3 py-2 font-medium">Status</th>}
                  <RowMenuHeading />
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <LinkedRow key={item.id} href={`${path}/${item.id}`} className={cn("group/row h-16 border-b border-line hover:bg-row-hover", dim(item))}>
                    <td className="px-3 py-2">
                      <ItemPhoto photo={item.photo} name={item.name} />
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`${path}/${item.id}`} className="flex flex-col">
                        <RowText name={item.name} detail={item.sku} />
                      </Link>
                    </td>
                    <td className="truncate px-3 py-2 text-subtle @max-[1000px]:hidden">{item.description}</td>
                    <td className="truncate px-3 py-2">{item.location}</td>
                    <td className="px-3 py-2 text-right tabular-nums @max-[760px]:hidden">{formatPrice(item.unitPriceCents)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.count}</td>
                    {availableFor && <td className="px-3 py-2 text-right tabular-nums">{item.available}</td>}
                    {kind === "inventory" && !availableFor && (
                      <td className="px-3 py-2">
                        <span className="flex flex-col items-start gap-1">
                          {item.next && <span className="truncate text-subtle tabular-nums">{nextReserved(item.next)}</span>}
                          {status(item)}
                        </span>
                      </td>
                    )}
                    {kind === "gift" && <td className="px-3 py-2 text-right tabular-nums @max-[700px]:hidden">{item.held}</td>}
                    {kind === "gift" && (
                      <td className="px-3 py-2">
                        {status(item)}
                      </td>
                    )}
                    <RowMenuCell>
                      <RowMenu kind={kind} item={item} isAdmin={isAdmin} back={back} />
                    </RowMenuCell>
                  </LinkedRow>
                ))}
              </tbody>
            </table>

            {/* Phone: full-width tappable rows; the Count, and any warning, take the row's end. */}
            <ul className="-mx-4 rail:hidden">
              {sorted.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "group/row relative flex min-h-16 items-center gap-3 border-b border-line px-4 py-2 active:bg-row-hover",
                    dim(item),
                  )}
                >
                  <ItemPhoto photo={item.photo} name={item.name} />
                  <Link href={`${path}/${item.id}`} className="flex min-w-0 flex-1 flex-col after:absolute after:inset-0">
                    <RowText name={item.name} detail={[item.location, item.sku].filter(Boolean).join(" · ")} />
                  </Link>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-right tabular-nums">
                    <span className="text-[17px] leading-5 font-medium">
                      <span className="sr-only">Count </span>
                      {item.count}
                    </span>
                    {availableFor ? (
                      <span className="text-[13px] leading-4 text-subtle">{item.available} available</span>
                    ) : (
                      status(item)
                    )}
                  </span>
                  <span className="relative z-1">
                    <RowMenu kind={kind} item={item} isAdmin={isAdmin} back={back} />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </ListScrollArea>
    </>
  );
}

type Listed = Awaited<ReturnType<typeof loaders.inventory>>["items"][number];

// A heading's sort, kept in the URL with the filters: ascending, or "-" for
// descending. None is by name, with a Gift that has none left at the end.
const sorts = ["name", "-name", "count", "-count", "price", "-price"] as const;
type Sort = (typeof sorts)[number];
type Column = "name" | "count" | "price";

function byColumn(sort: Sort) {
  const descending = sort.startsWith("-");
  const column = sort.replace("-", "") as Column;
  return (a: Listed, b: Listed) => {
    // An unknown Unit Price goes last either way.
    if (column === "price" && (a.unitPriceCents === null) !== (b.unitPriceCents === null)) return a.unitPriceCents === null ? 1 : -1;
    const order =
      column === "name"
        ? a.name.localeCompare(b.name)
        : column === "count"
          ? a.count - b.count
          : (a.unitPriceCents ?? 0) - (b.unitPriceCents ?? 0);
    return descending ? -order : order;
  };
}

// A heading that sorts by its column, and the other way once it does.
function SortHeading({
  label,
  by,
  sort,
  href,
  className,
}: {
  label: string;
  by: Column;
  sort: Sort | undefined;
  href: (change: Record<string, string | undefined>) => string;
  className?: string;
}) {
  const current = (sort ?? "name").replace("-", "") === by ? (sort?.startsWith("-") ? "descending" : "ascending") : undefined;
  const next = current === "ascending" ? `-${by}` : by;
  const numeric = by !== "name";
  const Arrow = current === "descending" ? ArrowDown : ArrowUp;
  return (
    <th aria-sort={current ?? "none"} className={cn("px-3 py-2 font-medium", numeric && "text-right", className)}>
      <Link
        href={href({ sort: next === "name" ? undefined : next })}
        className={cn("inline-flex items-center gap-1 underline-offset-4 hover:underline", numeric && "flex-row-reverse", current && "text-foreground")}
      >
        {label}
        {current && <Arrow size={14} aria-hidden className="shrink-0" />}
      </Link>
    </th>
  );
}

// "150 on Nov 3": what an Inventory Item's next Event holds, from the day it starts.
function nextReserved(next: NonNullable<Listed["next"]>) {
  return `${next.reserved} on ${formatShortDays(next.from, next.from)}`;
}

// A row's warning: a Shortage not yet acknowledged, or a Gift with none left.
function status(item: Listed) {
  if (item.shortBy !== null) return <Badge>{formatShort(item.shortBy)}</Badge>;
  if (item.held !== null && item.count === 0) return <Badge tone="plain">None left</Badge>;
  return null;
}

// A row's "⋯": the item page's menu, coming back to this list.
function RowMenu({ kind, item, isAdmin, back }: { kind: Kind; item: Listed; isAdmin: boolean; back: string }) {
  return (
    <ItemMenu
      kind={kind}
      item={{ id: item.id, name: item.name, archived: item.archived }}
      isAdmin={isAdmin}
      blocked={archiveBlocked(item.count, item.reserved)}
      back={back}
    />
  );
}

// A Gift with none left stays listed, dimmed, until it's Archived.
function dim(item: { count: number }) {
  return item.count === 0 && "text-subtle";
}

export function ListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="mb-3 h-11 w-64 max-w-full rounded-full bg-fill" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 rounded-md bg-fill" />
      ))}
    </div>
  );
}
