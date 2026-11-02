// Appearance is per device, not per person: System (the default), Light or
// Dark, kept in this browser's storage. Light and Dark go on <html> as
// data-theme; System leaves it off, so globals.css follows the OS live.

export const appearances = ["light", "dark", "system"] as const;
export type Appearance = (typeof appearances)[number];

export const appearanceKey = "appearance";

function isChosen(value: unknown): value is "light" | "dark" {
  return value === "light" || value === "dark";
}

/** The Appearance saved on this device; System when there's none, or no storage to read. */
export function savedAppearance(): Appearance {
  try {
    const saved = localStorage.getItem(appearanceKey);
    return isChosen(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

/** Shows an Appearance on this page. */
export function showAppearance(appearance: Appearance) {
  if (isChosen(appearance)) document.documentElement.dataset.theme = appearance;
  else delete document.documentElement.dataset.theme;
}

/** Saves an Appearance on this device and shows it. */
export function saveAppearance(appearance: Appearance) {
  try {
    if (isChosen(appearance)) localStorage.setItem(appearanceKey, appearance);
    else localStorage.removeItem(appearanceKey);
  } catch {
    // No storage (a private window): it lasts until the page is left.
  }
  showAppearance(appearance);
}

/** The saved Appearance shown before first paint, as an inline script in <head>. */
export const appearanceScript = `try{var a=localStorage.getItem(${JSON.stringify(appearanceKey)});if(a==="light"||a==="dark")document.documentElement.dataset.theme=a}catch(e){}`;
