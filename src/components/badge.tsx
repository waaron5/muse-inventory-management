import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  warning: "bg-warning-surface text-warning",
  // Progress rather than a warning: "2 of 5 loaded".
  plain: "bg-fill text-subtle",
};

/** A row's warning or progress in a word or two, at the row's end: "Short by 2". */
export function Badge({
  tone = "warning",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[13px] font-medium whitespace-nowrap tabular-nums",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
