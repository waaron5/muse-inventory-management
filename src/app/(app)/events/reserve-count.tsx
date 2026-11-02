"use client";

import { useState } from "react";
import { Field } from "@/components/form";
import { WarningPanel } from "@/components/warning-panel";
import { formatShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "6 available", "None available" or "Short by 2": Available can go below none (ADR 0002). */
export function availableLabel(available: number) {
  if (available > 0) return `${available} available`;
  return available === 0 ? "None available" : formatShort(-available);
}

/** What's Available, in the warning colour once there's none. */
export function Available({ available, className }: { available: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", available > 0 ? "text-subtle" : "text-warning", className)}>
      {availableLabel(available)}
    </span>
  );
}

/**
 * How many to reserve. Asking for more than is Available still saves; it says
 * so first, rather than blocking.
 */
export function ReserveCount({
  available,
  typed,
  autoFocus,
}: {
  available: number | null;
  typed?: string;
  autoFocus?: boolean;
}) {
  const [count, setCount] = useState(typed ?? "");
  const asked = Number(count);
  const over = available !== null && count !== "" && asked > Math.max(available, 0);
  return (
    <>
      <Field
        label="How many"
        name="count"
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        value={count}
        onChange={(e) => setCount(e.target.value)}
        autoFocus={autoFocus}
        required
      />
      {over && (
        <WarningPanel role="status" className="-mt-3">
          {available! > 0 ? `Only ${available} available.` : "None available."} It still saves, as a Shortage.
        </WarningPanel>
      )}
    </>
  );
}
