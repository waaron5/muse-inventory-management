"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Avatar } from "@/components/avatar";
import { buttonClass, FormActions, MainButton, TextButton } from "@/components/button";
import { failsInline, Field, fieldClass, FormError } from "@/components/form";
import { HoverLabel } from "@/components/hover-label";
import { SearchInput } from "@/components/search-field";
import { Sheet } from "@/components/sheet";
import { ItemThumb } from "@/components/thumb";
import { formatShort, formatShortDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import { catalogs, type Kind } from "../_catalog/kind";
import { addBorrowedItem, changeReserved, type LineFormState, removeLine, reserve } from "./actions";
import { Available, ReserveCount } from "./reserve-count";
import { type EventShortage, ShortageButton } from "./shortage";

type Line = {
  id: string;
  kind: "reservation" | "borrowed";
  /** A Reservation's item; a Borrowed Item has none. */
  item: { id: string; photo: string | null } | null;
  name: string;
  /** A Borrowed Item's lender. */
  lender: string | null;
  /** How many it needs: reserved or borrowed. */
  reserved: number;
  /** How many of a Gift were Given Away once its Event ended; null until then. */
  givenAway: number | null;
  /** Who added it and on which day; null on a Line from before that was kept. */
  addedBy: { name: string; colour?: number; on: string } | null;
  deleted?: boolean;
};
type Reservable = { id: string; name: string; sku: string | null; photo: string | null; available: number | null };

/**
 * An Event's Inventory or Gifts. Both add from the catalog; Inventory also
 * adds a Borrowed Item by hand, as "non-inventory".
 */
export function Lines({
  kind,
  eventId,
  lines,
  shortages,
  isAdmin,
  reservable,
  dates,
  cancelled,
}: {
  kind: Kind;
  eventId: string;
  lines: Line[];
  /** The Event's Shortages, flagged or acknowledged; a Line shows its own. */
  shortages: EventShortage[];
  isAdmin: boolean;
  reservable: Reservable[];
  /** The Hold Window, for an Inventory picker; null when the Event has no dates yet. */
  dates?: string | null;
  /** A Cancelled Event's Lines wait as they were until it's reinstated. */
  cancelled: boolean;
}) {
  const [adding, setAdding] = useState<"catalog" | "borrowed" | null>(null);
  // The catalog picker's chosen item, here so the sheet's back arrow can return to the search.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const title = catalogs[kind].title;
  const addLabel = kind === "inventory" ? "Add inventory" : "Add gift";
  const close = () => {
    setAdding(null);
    setPickedId(null);
  };
  // An Inventory Item holds across the Hold Window, so it waits for the Event's dates.
  const waiting = kind === "inventory" && !dates;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col items-start gap-3">
        <h2 className="font-heading text-[18px] leading-6 font-medium">{title}</h2>
        {!cancelled && (
          <TextButton icon={Plus} type="button" onClick={() => setAdding("catalog")}>{addLabel}</TextButton>
        )}
        {!cancelled && kind === "inventory" && (
          <TextButton icon={Plus} type="button" onClick={() => setAdding("borrowed")}>Add non-inventory</TextButton>
        )}
      </div>
      {lines.length > 0 && (
        <ul className="flex flex-col border-y border-line">
          {lines.map((line) => (
            <LineRow
              key={line.id}
              kind={kind}
              eventId={eventId}
              line={line}
              shortage={line.item ? shortages.find((s) => s.item.id === line.item?.id) : undefined}
              isAdmin={isAdmin}
              cancelled={cancelled}
            />
          ))}
        </ul>
      )}
      <Sheet
        open={adding === "catalog"}
        onOpenChange={(open) => !open && close()}
        title={addLabel}
        onBack={pickedId ? () => setPickedId(null) : undefined}
      >
        <Picker
          kind={kind}
          eventId={eventId}
          reservable={reservable}
          dates={dates}
          waiting={waiting}
          pickedId={pickedId}
          onPick={setPickedId}
          onDone={close}
        />
      </Sheet>
      {kind === "inventory" && (
        <Sheet open={adding === "borrowed"} onOpenChange={(open) => !open && close()} title="Add non-inventory">
          <BorrowedForm eventId={eventId} onDone={close} />
        </Sheet>
      )}
    </section>
  );
}

/**
 * A Line's count and what it counts, as its button reads it: how many it
 * needs, or for a Gift once Given Away, how many went (which can be none).
 */
function countOf(line: Line) {
  if (line.givenAway !== null) return { count: line.givenAway, word: "given away", fewest: 0 };
  return { count: line.reserved, word: line.kind === "borrowed" ? "borrowed" : "reserved", fewest: 1 };
}

// A Borrowed Item, entered by hand: never in the catalog, holding no Stock and unpriced.
function BorrowedForm({ eventId, onDone }: { eventId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    failsInline(async (s: LineFormState, form: FormData) => {
      const result = await addBorrowedItem(s, form);
      if (result.done) onDone();
      return result;
    }),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3 [&>label]:min-w-0">
        <Field label="Name" name="name" defaultValue={state.values?.name} className="min-w-0 w-full" autoComplete="off" autoFocus required />
        <Field
          label="How many"
          name="count"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          className="min-w-0 w-full"
          defaultValue={state.values?.count ?? 1}
          required
        />
      </div>
      <Field label="Borrowed from" name="lender" defaultValue={state.values?.lender} placeholder="Optional" autoComplete="off" />
      <FormError message={state.error} />
      <FormActions>
        <MainButton icon={Check} disabled={pending}>
          Add
        </MainButton>
      </FormActions>
    </form>
  );
}

// Tapping the name opens the item, if it has one; tapping the count edits it
// in place or removes the Line. A Gift's count, once it's Given Away, says how
// many went: changing it puts leftovers back or gives more away.
function LineRow({
  kind,
  eventId,
  line,
  shortage,
  isAdmin,
  cancelled,
}: {
  kind: Kind;
  eventId: string;
  line: Line;
  shortage?: EventShortage;
  isAdmin: boolean;
  cancelled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const done = (action: typeof changeReserved) => async (state: LineFormState, form: FormData) => {
    const result = await action(state, form);
    if (result.done) setEditing(false);
    return result;
  };
  const [changed, change, changing] = useActionState(failsInline(done(changeReserved)), {});
  const [removed, remove, removing] = useActionState(failsInline(done(removeLine)), {});
  const error = changed.error ?? removed.error;
  const { count, word, fewest } = countOf(line);
  return (
    <li className="flex flex-col border-b border-line last:border-b-0">
      {/* On a phone, the count's editor wraps under the name rather than squeezing it. */}
      <div className="flex min-h-14 flex-wrap items-center gap-3 py-2">
        <ItemThumb photo={line.item?.photo} />
        <span className="flex min-w-40 flex-1 flex-col">
          {line.item && !line.deleted ? (
            <Link href={`${catalogs[kind].path}/${line.item.id}`} className="truncate font-medium hover:underline">
              {line.name}
            </Link>
          ) : (
            <span className="truncate font-medium">{line.name}</span>
          )}
          {/* Wraps rather than truncating, so the Short button is never cut off. */}
          <span className="flex flex-wrap gap-x-1 text-[14px] text-subtle">
            {/* Each Line has one of these at most: a Gift Given Away holds nothing, so is never short. */}
            {line.kind === "borrowed" && <span>{line.lender ? `Borrowed from ${line.lender}` : "Borrowed item"}</span>}
            {line.deleted && <span>Deleted</span>}
            {line.givenAway !== null && <span>Given away</span>}
            {shortage && (
              <ShortageButton
                eventId={eventId}
                shortage={shortage}
                isAdmin={isAdmin}
                label={`${formatShort(shortage.shortBy)}${shortage.flagged ? "" : ", acknowledged"}`}
                className={cn(
                  "inline-flex items-center gap-0.5 whitespace-nowrap hover:underline",
                  shortage.flagged && "font-medium text-warning",
                )}
              >
                {formatShort(shortage.shortBy)}
                {!shortage.flagged && <Check size={14} strokeWidth={2} aria-hidden />}
              </ShortageButton>
            )}
          </span>
        </span>
        {line.addedBy && <AddedBy {...line.addedBy} />}
        {editing ? (
          <form action={change} className="ml-auto flex items-center gap-2">
            <input type="hidden" name="lineId" value={line.id} />
            <input
              name="count"
              type="number"
              min={fewest}
              step={1}
              inputMode="numeric"
              defaultValue={changed.values?.count ?? count}
              aria-label={`How many ${line.name}`}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              autoFocus
              required
              className={cn(fieldClass, "w-20 tabular-nums")}
            />
            <MainButton icon={Check} type="submit" disabled={changing || line.deleted}>Save</MainButton>
            <MainButton icon={Trash2} type="submit" formAction={remove} formNoValidate disabled={removing || (!isAdmin && line.givenAway !== null)} title={!isAdmin && line.givenAway !== null ? "Ask an Admin" : undefined}>Remove</MainButton>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={cancelled}
            aria-label={`${count} ${word}. Change how many`}
            className={buttonClass("secondary", "min-w-11 px-3 font-sans tabular-nums")}
          >
            {count}
          </button>
        )}
      </div>
      {editing && <FormError message={error} />}
    </li>
  );
}

// The bubble of whoever added a Line, beside its count.
function AddedBy({ name, colour, on }: { name: string; colour?: number; on: string }) {
  const label = `Added by ${name} · ${formatShortDays(on, on)}`;
  return (
    <HoverLabel label={label} tap>
      <button type="button" aria-label={label} className="shrink-0 rounded-full">
        <Avatar name={name} colour={colour} small />
      </button>
    </HoverLabel>
  );
}

// Search, pick, then say how many. Asking for more than is Available still saves.
function Picker({
  kind,
  eventId,
  reservable,
  dates,
  waiting,
  pickedId,
  onPick,
  onDone,
}: {
  kind: Kind;
  eventId: string;
  reservable: Reservable[];
  dates?: string | null;
  waiting: boolean;
  pickedId: string | null;
  onPick: (id: string) => void;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    failsInline(async (s: LineFormState, form: FormData) => {
      const result = await reserve(s, form);
      if (result.done) onDone();
      return result;
    }),
    {},
  );
  const [query, setQuery] = useState("");
  const picked = reservable.find((r) => r.id === pickedId);
  const term = query.trim().toLowerCase();
  const matches = reservable.filter(
    (r) => !term || r.name.toLowerCase().includes(term) || r.sku?.toLowerCase().includes(term),
  );

  if (picked) {
    return (
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="itemId" value={picked.id} />
        <div className="flex items-center gap-3">
          <ItemThumb photo={picked.photo} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{picked.name}</span>
            {picked.available !== null && <Available available={picked.available} className="text-[14px]" />}
          </span>
        </div>
        <ReserveCount available={picked.available} typed={state.values?.count} autoFocus />
        <FormError message={state.error} />
        <FormActions>
          <MainButton icon={Check} disabled={pending}>
            Add
          </MainButton>
        </FormActions>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {waiting ? <p className="text-subtle">Add Event dates to reserve inventory.</p> : (
        <>
          {dates && <p className="text-subtle">Available for {dates}</p>}
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or SKU"
            autoFocus
          />
          {matches.length === 0 ? (
            <p className="py-4 text-subtle">{reservable.length === 0 ? catalogs[kind].none : "Nothing matches."}</p>
          ) : (
            <ul className="-mx-2 flex max-h-[50dvh] flex-col overflow-y-auto">
              {matches.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onPick(r.id)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-row-hover"
                  >
                    <ItemThumb photo={r.photo} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{r.name}</span>
                      {r.sku && <span className="truncate text-[14px] text-subtle">{r.sku}</span>}
                    </span>
                    {r.available !== null && <Available available={r.available} className="text-[14px]" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
