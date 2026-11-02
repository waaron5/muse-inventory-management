import type { ActivityPart, ActivityRef } from "@/lib/activity";

// Builds an Activity sentence as it reads after the person's name. Records it
// names keep the name they had then.

/** `said\`moved ${count} ${ref.item(...)} to ${ref.location(...)}\`` */
export function said(strings: TemplateStringsArray, ...values: (string | number | ActivityRef | ActivityPart[])[]) {
  const parts: ActivityPart[] = [];
  const push = (part: ActivityPart) => {
    const last = parts.at(-1);
    if (typeof part === "string" && typeof last === "string") parts[parts.length - 1] = last + part;
    else if (part !== "") parts.push(part);
  };
  strings.forEach((text, i) => {
    push(text);
    if (i >= values.length) return;
    const value = values[i];
    if (Array.isArray(value)) value.forEach(push);
    else push(typeof value === "number" ? String(value) : value);
  });
  return parts;
}

/** "a", "a and b", "a, b and c". */
export function listed(items: ActivityPart[][]) {
  return items.flatMap((item, i) => [
    ...(i === 0 ? [] : [i === items.length - 1 ? " and " : ", "]),
    ...item,
  ]);
}

export const ref = {
  event: (id: string, name: string): ActivityRef => ({ ref: "event", id, name }),
  item: (id: string, name: string, itemKind: "inventory" | "gift"): ActivityRef => ({ ref: "item", id, name, itemKind }),
  client: (id: string, name: string): ActivityRef => ({ ref: "client", id, name }),
  location: (id: string, name: string): ActivityRef => ({ ref: "location", id, name }),
  category: (id: string, name: string): ActivityRef => ({ ref: "category", id, name }),
  user: (id: string, name: string): ActivityRef => ({ ref: "user", id, name }),
};
