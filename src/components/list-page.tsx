import type { ReactNode } from "react";

/** Keeps a main list's controls above its independently scrolling rows. */
export function ListPage({ children }: { children: ReactNode }) {
  return <div className="list-page flex min-h-0 flex-1 flex-col">{children}</div>;
}

/**
 * Named and focusable so the rows also scroll with the keyboard. Its rows drop
 * columns by its width. It holds anything placed absolutely within its rows,
 * such as a screen reader's label, so nothing there can stretch the page.
 */
export function ListScrollArea({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="@container relative -mx-4 min-h-0 flex-1 overflow-auto overscroll-contain pr-8 pl-4 [scrollbar-gutter:stable] rail:mx-0 rail:pr-8 rail:pl-0 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-2 [&_thead]:bg-background"
    >
      {children}
    </div>
  );
}

/** A compact final column keeps the control at the row's edge. */
export function RowMenuCell({ children }: { children: ReactNode }) {
  return (
    <td className="py-2 pr-3 pl-1">
      <div className="flex justify-end">{children}</div>
    </td>
  );
}
