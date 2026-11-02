import { photoEdge, photoPath } from "./photos";

// A failure whose own words are for the person: one the browser can't open.
class UploadRefused extends Error {}

/** What went wrong with an upload, in words for the person. */
export function uploadFailureMessage(error: unknown, otherwise = "The photo didn't upload. Try again.") {
  return error instanceof UploadRefused ? error.message : otherwise;
}

/** What a photo picker accepts: anything the camera roll offers, iPhone HEIC included. */
export const photoAccept = "image/*,.heic,.heif";

/**
 * Makes a picked photo JPEG in the browser, at both sizes, and uploads it
 * straight to storage. Returns its key, for a command to record. The original
 * isn't kept.
 */
export async function uploadPhoto(file: File) {
  const picture = await decode(file);
  const key = crypto.randomUUID();
  try {
    // The Blob client, with its token library, loads only when a photo is
    // sent, while the copies encode: the bug report imports this on every page.
    const [{ upload }, copies] = await Promise.all([
      import("@vercel/blob/client"),
      Promise.all((["full", "small"] as const).map(async (size) => [size, await jpeg(picture, photoEdge[size])] as const)),
    ]);
    await Promise.all(
      copies.map(([size, body]) =>
        upload(photoPath(key, size), body, {
          access: "private",
          contentType: "image/jpeg",
          handleUploadUrl: "/api/photos/upload",
        }),
      ),
    );
  } finally {
    picture.close();
  }
  return key;
}

/** A picked image as a JPEG, at most `edge` pixels on its longest side. */
export async function jpegOf(file: File, edge: number) {
  const picture = await decode(file);
  try {
    return await jpeg(picture, edge);
  } finally {
    picture.close();
  }
}

// The browser's own decoder first: Safari opens HEIC itself. Anywhere else a
// HEIC is opened by libheif, loaded only when it's needed.
async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    try {
      const { heicTo } = await import("heic-to");
      return await heicTo({ blob: file, type: "bitmap" });
    } catch {
      throw new UploadRefused("That file can't be opened as a photo.");
    }
  }
}

function jpeg(picture: ImageBitmap, edge: number) {
  const scale = Math.min(1, edge / Math.max(picture.width, picture.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(picture.width * scale);
  canvas.height = Math.round(picture.height * scale);
  canvas.getContext("2d")!.drawImage(picture, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("JPEG encoding failed"))), "image/jpeg", 0.85),
  );
}
