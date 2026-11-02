"use client";

import { Tooltip } from "radix-ui";
import { type ReactElement, useState } from "react";

/**
 * A short label below a control, after a quarter second of hover or on focus.
 * With `tap`, tapping it shows the label too, for what has nothing else to
 * do on a phone, like a person's bubble.
 */
export function HoverLabel({ label, tap, children }: { label: string; tap?: boolean; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={0}>
      <Tooltip.Root {...(tap && { open, onOpenChange: setOpen })}>
        <Tooltip.Trigger asChild {...(tap && { onClick: () => setOpen(true) })}>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            sideOffset={8}
            collisionPadding={8}
            className="hover-label z-50 max-w-64 rounded-md bg-ink px-3 py-2 text-[13px] font-medium text-background shadow-raised"
          >
            {label}
            <Tooltip.Arrow className="fill-ink" width={12} height={6} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
