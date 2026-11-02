/** Borderless detail-card actions; destructive actions use the shared red surface. */
export function iconAction(danger = false) {
  return `inline-flex size-11 shrink-0 items-center justify-center rounded-md disabled:opacity-40 ${danger ? "hover:bg-alert-surface hover:text-alert" : "hover:bg-hover"}`;
}
