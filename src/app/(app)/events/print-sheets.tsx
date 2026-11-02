"use client";

import { Printer } from "lucide-react";
import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MainButton } from "@/components/button";
import type { ClientColour } from "@/lib/client-colour";
import type { QrCode } from "@/lib/qr";

type Group = { heading: string | null; rows: { name: string; count: number }[] };
type Block = { band: string } | { row: { name: string; count: number } };
type PrintEvent = { name: string; client: { name: string; colour: ClientColour } };

// The Print list on US Letter sheets, as the approved prototype lays them out:
// the Event Name, Client and a QR code to the Event atop page 1, then a black
// heading per Location (or lender) with checkbox · count · name rows. Pages 2
// onward repeat the Event in a small line, and a list of several pages counts
// them at the foot. Sizes are inches and points: this is paper, light in Dark mode too.

const sheet =
  "flex h-[11in] w-[8.5in] flex-none flex-col bg-paper scheme-light px-[.6in] py-[.55in] text-[12pt] leading-[1.25] text-paper-ink shadow-raised [print-color-adjust:exact] print:shadow-none not-last:print:break-after-page";
// What a block takes, top margin and all: the body is a flex column, so nothing collapses.
const band = "mt-[14pt] rounded-[5pt] bg-paper-ink px-[11pt] py-[6pt] font-heading text-[15pt] font-semibold text-paper";
const row = "grid grid-cols-[.28in_.55in_1fr] items-center gap-x-[.14in] border-b-[.75pt] border-paper-line py-[7pt]";

/** The sheets, paged to fit, shrunk to fit the screen and printed full size. */
export function PrintSheets({ event, qr, groups }: { event: PrintEvent; qr: QrCode; groups: Group[] }) {
  const blocks = useMemo(
    () => groups.flatMap((g): Block[] => [...(g.heading ? [{ band: g.heading }] : []), ...g.rows.map((r) => ({ row: r }))]),
    [groups],
  );
  // Until measured, one sheet holds everything.
  const [pages, setPages] = useState<Block[][]>([blocks]);
  const measurer = useRef<HTMLDivElement>(null);
  const desk = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const paginate = () => {
      const [first, later] = measurer.current?.querySelectorAll<HTMLElement>("[data-body]") ?? [];
      if (!first || !later) return;
      setPages(paged(blocks, heights(first), first.clientHeight, later.clientHeight));
    };
    paginate();
    // The fonts change every height once they arrive.
    document.fonts?.ready.then(paginate);
  }, [blocks]);

  useLayoutEffect(() => {
    const el = desk.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setZoom(Math.min(1, el.clientWidth / (8.5 * 96))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={desk} className="relative overflow-hidden">
      <style>{"@page { size: letter portrait; margin: 0; }"}</style>
      {/* Sheets nobody sees, to measure each block and how much a page holds. */}
      <div ref={measurer} aria-hidden className="invisible absolute top-0 left-0 -z-10 print:hidden">
        <Sheet event={event} qr={qr} page={0} of={1}>
          {blocks.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </Sheet>
        <Sheet event={event} qr={qr} page={1} of={2} />
      </div>
      <div className="flex flex-col items-center gap-7 print:block print:[zoom:1]!" style={{ zoom }}>
        {pages.map((blocksOnPage, page) => (
          <Sheet key={page} event={event} qr={qr} page={page} of={pages.length}>
            {blocksOnPage.map((b, i) => (
              <BlockView key={i} block={b} />
            ))}
          </Sheet>
        ))}
      </div>
    </div>
  );
}

/** The page's one main button: the browser's print dialog, which also saves a PDF. */
export function PrintButton() {
  return (
    <MainButton icon={Printer} onClick={() => window.print()}>
      Print
    </MainButton>
  );
}

function Sheet({ event, qr, page, of, children }: { event: PrintEvent; qr: QrCode; page: number; of: number; children?: ReactNode }) {
  return (
    <section className={sheet} aria-label={`Page ${page + 1} of ${of}`}>
      {page === 0 ? (
        <header className="mb-[6pt] flex items-start justify-between gap-[20pt]">
          <div>
            <h2 className="font-heading text-[26pt] leading-[1.05] font-semibold text-balance">{event.name}</h2>
            <p className={`client-${event.client.colour} mt-[6pt] inline-flex items-center gap-[6pt] text-[13pt] text-paper-subtle`}>
              <span aria-hidden className="size-[9pt] rounded-[2pt] bg-(--client-accent)" />
              {event.client.name}
            </p>
          </div>
          <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="QR code to this Event" className="size-[.8in] flex-none text-paper-ink">
            <path fill="currentColor" d={qr.d} />
          </svg>
        </header>
      ) : (
        <header className="mb-[4pt] flex items-baseline justify-between border-b-[.75pt] border-paper-line pb-[6pt] text-[10pt] text-paper-subtle">
          <b className="font-heading text-[12pt] font-semibold text-paper-ink">{event.name}</b>
          <span>{event.client.name}</span>
        </header>
      )}
      <div data-body className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      <p className="pt-[6pt] text-right text-[9pt] text-paper-subtle">{of > 1 ? `${page + 1} / ${of}` : " "}</p>
    </section>
  );
}

function BlockView({ block }: { block: Block }) {
  if ("band" in block) return <h3 className={band}>{block.band}</h3>;
  return (
    <div className={row}>
      <span aria-hidden className="size-[.28in] rounded-[3pt] border-[1.5pt] border-paper-ink" />
      <span className="text-right font-heading text-[17pt] leading-none font-semibold">{block.row.count}</span>
      <span className="text-[13pt] font-medium">{block.row.name}</span>
    </div>
  );
}

// Each block's height in a body, its top margin included.
function heights(body: HTMLElement) {
  let above = 0;
  return [...body.children].map((el) => {
    const { offsetTop, offsetHeight } = el as HTMLElement;
    const height = offsetTop + offsetHeight - above;
    above = offsetTop + offsetHeight;
    return height;
  });
}

// Fills each page in turn; a heading left at the foot of a page moves on with
// the row after it.
function paged(blocks: Block[], blockHeights: number[], firstHolds: number, laterHolds: number) {
  const pages: number[][] = [[]];
  let used = 0;
  let holds = firstHolds;
  blocks.forEach((_, i) => {
    let page = pages[pages.length - 1];
    if (used + blockHeights[i] > holds + 1 && page.length > 0) {
      const carried: number[] = [];
      while (page.length > 1 && "band" in blocks[page[page.length - 1]]) carried.unshift(page.pop()!);
      page = carried;
      pages.push(page);
      used = carried.reduce((sum, j) => sum + blockHeights[j], 0);
      holds = laterHolds;
    }
    page.push(i);
    used += blockHeights[i];
  });
  return pages.map((page) => page.map((i) => blocks[i]));
}
