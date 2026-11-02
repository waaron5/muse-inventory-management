"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState } from "react";
import { fieldClass } from "./form";
import { cn } from "@/lib/utils";

/** A whole-number field with compact, always-visible increment controls. */
export function CountStepper({ label, name, defaultValue = 0 }: { label: string; name: string; defaultValue?: number | string }) {
  const id = useId();
  const [value, setValue] = useState(String(defaultValue));
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0">{label}</label>
      <div className="relative w-28 shrink-0">
        <input id={id} name={name} type="number" min={0} step={1} inputMode="numeric" required
          value={value} onChange={(event) => setValue(event.target.value)}
          className={cn(fieldClass, "count-stepper w-full pr-9 text-right tabular-nums")} />
        <div className="absolute top-px right-px bottom-px grid w-8 grid-rows-2 overflow-hidden rounded-r-md border-l border-line">
          <button type="button" aria-label={`Increase ${label}`} onClick={() => setValue(String(Math.max(0, Number(value) || 0) + 1))} className="flex items-center justify-center hover:bg-hover">
            <ChevronUp size={14} aria-hidden />
          </button>
          <button type="button" aria-label={`Decrease ${label}`} disabled={Number(value) <= 0} onClick={() => setValue(String(Math.max(0, (Number(value) || 0) - 1)))} className="flex items-center justify-center hover:bg-hover disabled:opacity-40">
            <ChevronDown size={14} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
