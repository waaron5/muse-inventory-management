"use client";

import { Fragment, type ReactNode, useState } from "react";
import { RowList } from "@/components/row-list";
import { SearchInput } from "@/components/search-field";
import { ViewMoreButton } from "@/components/view-more";

/** A card shows this many rows, then "View N more". */
const SHOWN = 8;

/**
 * A card's heading, with its search and main button (if any) at the right of
 * the same row; on phone the search takes a row of its own beneath.
 */
export function CardHeader({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-4 rail:flex-nowrap">
    {/* Focusable, so the Settings menu can move focus here as it scrolls. */}
    <h2 id={id} tabIndex={-1} className="grow font-heading text-[20px] leading-7 font-medium">{title}</h2>
    {children}
  </div>;
}

/** The text a row is found by, and the row itself, rendered on the server. */
export type ListRow = { key: string; text: string; row: ReactNode };

/**
 * A Settings card's list: the first eight rows, then "View N more" for the
 * rest. With `search` (its label), a search box beside the main button
 * narrows the rows to those whose text has what's typed. With no rows at all,
 * `empty` stands in for the list.
 */
export function SettingsList({ id, title, action, search, rows, empty }: {
  id: string;
  title: string;
  action?: ReactNode;
  search?: string;
  rows: ListRow[];
  empty?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const wanted = query.trim().toLowerCase();
  const found = wanted ? rows.filter((r) => r.text.toLowerCase().includes(wanted)) : rows;
  const shown = all ? found : found.slice(0, SHOWN);
  return (
    <section aria-labelledby={id}>
      <CardHeader id={id} title={title}>
        {search && <div className="order-last w-full min-w-0 rail:order-none rail:w-56">
          <SearchInput aria-label={search} placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>}
        {action}
      </CardHeader>
      {rows.length === 0 && empty ? empty : found.length === 0 && wanted ? <p className="py-8 text-subtle">Nothing matches.</p> : (
        <RowList>{shown.map((r) => <Fragment key={r.key}>{r.row}</Fragment>)}</RowList>
      )}
      {shown.length < found.length && (
        <ViewMoreButton onClick={() => setAll(true)}>View {found.length - shown.length} more</ViewMoreButton>
      )}
    </section>
  );
}
