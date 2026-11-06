// Activity: every change anyone made to Muse's data, with who and when. Each
// entry is one sentence that follows the person's name ("added 6 Chairs to
// BRL Cove 26"), keeping the names it mentions as they were then.

/** Which type chip an entry falls under. */
export const activityAreas = ["events", "catalog", "stock", "people"] as const;
export type ActivityArea = (typeof activityAreas)[number];

export const activityAreaLabel: Record<ActivityArea, string> = {
  events: "Events",
  catalog: "Catalog",
  stock: "Stock",
  people: "People",
};

/** A record an entry names, as it was named then. Events and items link to their page while they exist. */
export type ActivityRef = {
  ref: "event" | "item" | "client" | "location" | "category" | "user";
  id: string;
  name: string;
  itemKind?: "inventory" | "gift";
};

export type ActivityPart = string | ActivityRef;

/** A sentence as it reads, without its links: "reserved 6 Chairs for Gala". */
export function sentenceText(sentence: readonly (string | { name: string })[]) {
  return sentence.map((part) => (typeof part === "string" ? part : part.name)).join("");
}
