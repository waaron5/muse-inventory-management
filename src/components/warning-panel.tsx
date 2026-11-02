import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A warning in a block of its own: asking for more than is Available, or an Event's Shortages. */
export function WarningPanel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-md bg-warning-surface px-3 py-2 text-warning", className)} {...props} />;
}
