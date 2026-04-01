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

const VARIANT_STYLES: Record<StatusVariant, { bg: string; color: string; label: string }> = {
  active:    { bg: "#dcfce7", color: "#166534", label: "Active" },
  retired:   { bg: "#f3f4f6", color: "#6b7280", label: "Retired" },
  pending:   { bg: "#fef9c3", color: "#854d0e", label: "Pending" },
  approved:  { bg: "#dcfce7", color: "#166534", label: "Approved" },
  rejected:  { bg: "#fee2e2", color: "#991b1b", label: "Rejected" },
  canceled:  { bg: "#f3f4f6", color: "#6b7280", label: "Canceled" },
  completed: { bg: "#eff6ff", color: "#1d4ed8", label: "Completed" },
  consumed:  { bg: "#f3f4f6", color: "#6b7280", label: "Consumed" },
  past:      { bg: "#f3f4f6", color: "#6b7280", label: "Past" },
  current:   { bg: "#dcfce7", color: "#166534", label: "Active" },
  future:    { bg: "#eff6ff", color: "#1d4ed8", label: "Upcoming" },
};

interface StatusBadgeProps {
  variant: StatusVariant;
  label?: string;
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  const style = VARIANT_STYLES[variant] ?? VARIANT_STYLES.active;
  const displayLabel = label ?? style.label;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 500,
        background: style.bg,
        color: style.color,
        whiteSpace: "nowrap",
      }}
    >
      {displayLabel}
    </span>
  );
}
