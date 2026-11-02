// Each Event is colour-coded by its Client, as in v1's company themes, so a
// Client's Events are easy to tell apart and find in the list.
export const clientColours = ["rose", "orange", "yellow", "green", "blue", "violet"] as const;
export type ClientColour = (typeof clientColours)[number];

// Picked by hand in v1; everyone else gets one from their name.
const known: Record<string, ClientColour> = {
  ivorypeak: "rose",
  birchline: "violet",
  "birch line": "violet",
};
// Grey and teal took the first two places until yellow and orange replaced them.
const hashed: readonly ClientColour[] = ["yellow", "orange", "green", "violet", "blue"];

/** The initial colour saved for a new Client; later names never change it. */
export function clientColour(clientName: string): ClientColour {
  const name = clientName.trim().replace(/\s+/g, " ").toLowerCase();
  if (known[name]) return known[name];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hashed[hash % hashed.length];
}
