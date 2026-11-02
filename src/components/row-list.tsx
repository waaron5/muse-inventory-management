import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A screen's plain list of rows, full width on phone: Users, Clients, Locations. */
export function RowList({ children }: { children: ReactNode }) {
  return <ul className="-mx-4 border-t border-line rail:mx-0">{children}</ul>;
}

/**
 * One row: what leads it, its name with a line beneath, then its badge and
 * "⋯" at the end. One no longer in use is dimmed. With `href`, its name is a
 * link there.
 */
export function Row({
  lead,
  name,
  detail,
  dimmed,
  href,
  children,
}: {
  lead?: ReactNode;
  name: ReactNode;
  detail: string;
  dimmed?: boolean;
  href?: string;
  children?: ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex min-h-16 items-center gap-3 border-b border-line px-4 py-2 rail:min-h-14 rail:px-0",
        dimmed && "text-subtle",
      )}
    >
      {lead}
      <RowText name={href ? <Link href={href}>{name}</Link> : name} detail={detail} />
      {children}
    </li>
  );
}

/** Settings and main lists share the same title/subtitle sizing and rhythm. */
export function RowText({ name, detail }: { name: ReactNode; detail?: ReactNode }) {
  return <span className="flex min-w-0 flex-1 flex-col leading-6">
    <span className="truncate font-medium">{name}</span>
    {detail && <span className="truncate text-[14px] text-subtle">{detail}</span>}
  </span>;
}

export function RowListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="mb-3 h-9 w-40 rounded-md bg-fill" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 rounded-md bg-fill" />
      ))}
    </div>
  );
}
