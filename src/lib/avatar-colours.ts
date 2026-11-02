/** Palette choices use the same colour identities as automatically assigned avatars. */
export const avatarColourChoices = [
  "Red", "Green", "Violet", "Gold", "Cyan", "Rose",
  "Lime", "Indigo", "Orange", "Mint", "Orchid", "Citron",
] as const;

// Keep stored identities stable while offering a smaller, distinct palette.
export const profileColourChoices = [0, 3, 1, 4, 7, 2].map((colour) => ({
  colour,
  label: avatarColourChoices[colour],
}));
