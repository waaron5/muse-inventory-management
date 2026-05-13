import { del, put } from "@vercel/blob";
import {
  INVENTORY_IMAGE_ACCEPTED_MIME_TYPES,
  validateInventoryImageFile,
} from "@/lib/inventory-image";

const AVATAR_PATH_PREFIX = "avatars/";

export class AvatarUploadError extends Error {}

export function isManagedAvatarUrl(url?: string | null) {
  if (!url) return false;
  try {
    const { hostname, pathname } = new URL(url);
    return (
      hostname.endsWith(".blob.vercel-storage.com") && pathname.startsWith(`/${AVATAR_PATH_PREFIX}`)
    );
  } catch {
    return false;
  }
}

export async function saveAvatarFile(file: File) {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new AvatarUploadError("Image uploads are not configured.");
  }

  const validationError = validateInventoryImageFile(file);
  if (validationError) throw new AvatarUploadError(validationError);

  const extensionByMimeType: Record<(typeof INVENTORY_IMAGE_ACCEPTED_MIME_TYPES)[number], string> =
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

  const extension = extensionByMimeType[file.type as keyof typeof extensionByMimeType];
  if (!extension) throw new AvatarUploadError("Upload a JPG, PNG, or WEBP image.");

  const filename = `${AVATAR_PATH_PREFIX}${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const blob = await put(filename, file, { access: "public", contentType: file.type });
  return blob.url;
}

export async function deleteManagedAvatar(url?: string | null) {
  if (!isManagedAvatarUrl(url)) return;
  try {
    await del(url!);
  } catch {
    // best-effort
  }
}
