export function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(value: string, includeYear = false) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
  });
}

// Short month + day + year — used for "last updated" and audit timestamps.
export function formatAuditDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// "Apr 22 – May 1, 2026" — accepts Date objects or ISO strings.
export function formatDateRange(start: Date | string, end: Date | string) {
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;
  return `${startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}
