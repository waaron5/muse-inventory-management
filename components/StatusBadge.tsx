type StatusVariant =
  | "active"
  | "retired"
  | "pending"
  | "approved"
  | "rejected"
  | "canceled"
  | "completed"
  | "consumed"
  | "past"
  | "current"
  | "future";

const VARIANT_LABELS: Record<StatusVariant, string> = {
  active: "Active",
  retired: "Retired",
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  canceled: "Canceled",
  completed: "Completed",
  consumed: "Consumed",
  past: "Past",
  current: "Active",
  future: "Upcoming",
};

interface StatusBadgeProps {
  variant: StatusVariant;
  label?: string;
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  const displayLabel = label ?? VARIANT_LABELS[variant] ?? VARIANT_LABELS.active;

  return <span className={`status-badge status-badge-${variant}`}>{displayLabel}</span>;
}
