// Photos live in a private Blob store, each kept twice: about 2000px to open
// full size, and small for list rows and tiles. A photo is known by its key;
// both copies are named from it and served, to signed-in people only, by
// `/api/photos/[key]`. Every name and address of a photo is made here.

export type PhotoSize = "full" | "small";

/** The longest side of each copy, in pixels. */
export const photoEdge: Record<PhotoSize, number> = { full: 2000, small: 480 };

const key = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const smallSuffix = "-small";

export function photoPath(photo: string, size: PhotoSize) {
  return `photos/${photo}${size === "small" ? smallSuffix : ""}.jpg`;
}

/** What an upload may be named: one copy of one photo. */
export const photoPathPattern = new RegExp(`^photos/${key}(${smallSuffix})?\\.jpg$`);

export function photoSrc(photo: string, size: PhotoSize) {
  return `/api/photos/${photo}${size === "small" ? "?size=small" : ""}`;
}

/** The full-size copy, saved rather than shown. */
export function photoDownload(photo: string) {
  return `/api/photos/${photo}?download`;
}

/** Which copy, and how, a photo's address asks for. */
export function photoAsked(searchParams: URLSearchParams): { size: PhotoSize; download: boolean } {
  return { size: searchParams.get("size") === "small" ? "small" : "full", download: searchParams.has("download") };
}
