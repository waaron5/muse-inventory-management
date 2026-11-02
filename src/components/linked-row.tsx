"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A table row that opens `href` when clicked anywhere, as its name's link does.
 * The link stays the way in for keyboards and screen readers; this only widens
 * where a mouse can click. Not a link stretched over the row: Safari before
 * 2026 can't position within a `<tr>`, so every row's link covered the whole
 * page, filters included, and the last row's won.
 */
export function LinkedRow({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  function open(event: MouseEvent<HTMLTableRowElement>) {
    const target = event.target as Element;
    // The row's own controls keep their clicks, and so do menus and dialogs
    // opened from it, which sit elsewhere on the page.
    if (!event.currentTarget.contains(target) || target.closest("a, button, input, label, [role='button']")) return;
    // Selecting a name to copy it isn't opening the row.
    if (window.getSelection()?.toString()) return;
    if (event.metaKey || event.ctrlKey) window.open(href, "_blank");
    else router.push(href);
  }
  return (
    <tr onClick={open} className={cn("cursor-pointer", className)}>
      {children}
    </tr>
  );
}
