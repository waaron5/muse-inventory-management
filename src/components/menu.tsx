"use client";

import { Ellipsis } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// One dropdown look for every menu: the account, "⋯" and filter chips.

/** A menu item's icon. */
export const menuIcon = { size: 18, strokeWidth: 1.75, "aria-hidden": true, className: "text-subtle" } as const;

/** The panel a menu or a chip's popover floats in. */
export const floating = "z-50 rounded-lg border border-line bg-popover shadow-floating";

export function MenuContent({ className, ...content }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          floating,
          "menu-fade max-h-(--radix-dropdown-menu-content-available-height) min-w-[200px] overflow-y-auto p-1",
          className,
        )}
        {...content}
      />
    </DropdownMenu.Portal>
  );
}

/**
 * One choice in a menu. A disabled one says why at its end: "Ask an Admin"
 * for an action only an Admin may take (Admin vs User permissions).
 */
export function MenuItem({
  selected,
  hint,
  className,
  children,
  ...item
}: ComponentProps<typeof DropdownMenu.Item> & { selected?: boolean; hint?: string }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex h-10 items-center gap-3 rounded-sm px-3 outline-none data-disabled:opacity-60 data-highlighted:bg-hover",
        selected && "bg-selected font-medium data-highlighted:bg-selected",
        className,
      )}
      {...item}
    >
      {/* `asChild` takes exactly one child, so a hint is added only when there is one. */}
      {hint ? (
        <>
          {children}
          <span className="ml-auto pl-3 text-[13px] text-subtle">{hint}</span>
        </>
      ) : (
        children
      )}
    </DropdownMenu.Item>
  );
}

/** A hairline between a menu's groups of like items. */
export function MenuSeparator() {
  return <DropdownMenu.Separator className="-mx-1 my-1 border-t border-line" />;
}

/**
 * A borderless "⋯" that opens a menu, with neutral hover and open feedback.
 * On a list's row (`group/row`) it shows only while the row is hovered, where
 * a mouse can hover; on phone and touch it always shows.
 */
export function MoreTrigger({ label, onRow }: { label: string; onRow?: boolean }) {
  return (
    <DropdownMenu.Trigger
      aria-label={label}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-hover data-[state=open]:bg-hover",
        onRow &&
          "rail:pointer-fine:opacity-0 rail:pointer-fine:group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
      )}
    >
      <Ellipsis size={20} strokeWidth={1.75} aria-hidden />
    </DropdownMenu.Trigger>
  );
}
