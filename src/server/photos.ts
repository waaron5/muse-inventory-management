import "server-only";
import * as Sentry from "@sentry/nextjs";
import { del, get } from "@vercel/blob";
import { type PhotoSize, photoPath } from "@/lib/photos";

/** One copy of a photo from the private store, or null if it isn't there. */
export async function readPhoto(key: string, size: PhotoSize) {
  const found = await get(photoPath(key, size), { access: "private" });
  return found?.statusCode === 200 ? found.stream : null;
}

/**
 * Removes photos from storage once whatever pointed at them is gone. A failure
 * only leaves a file nobody can reach, so it's reported, never shown.
 */
export async function removePhotos(...keys: (string | null)[]) {
  const paths = keys.filter((key) => key !== null).flatMap((key) => [photoPath(key, "full"), photoPath(key, "small")]);
  if (paths.length === 0) return;
  try {
    await del(paths);
  } catch (error) {
    Sentry.captureException(error);
    console.error(JSON.stringify({ at: "photos", error: String(error) }));
  }
}
