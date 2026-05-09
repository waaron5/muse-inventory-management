import { del, put } from "@vercel/blob";
import {
  INVENTORY_IMAGE_ACCEPTED_MIME_TYPES,
  validateInventoryImageFile,
} from "@/lib/inventory-image";

const INVENTORY_IMAGE_PATH_PREFIX = "inventory/";

export class InventoryImageUploadError extends Error {}

export function isManagedInventoryImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return false;
  try {
    const { hostname, pathname } = new URL(imageUrl);
    return (
      hostname.endsWith(".blob.vercel-storage.com") &&
      pathname.startsWith(`/${INVENTORY_IMAGE_PATH_PREFIX}`)
    );
  } catch {
    return false;
  }
}

export async function saveInventoryImageFile(file: File) {
  const validationError = validateInventoryImageFile(file);
  if (validationError) {
    throw new InventoryImageUploadError(validationError);
  }

  const extensionByMimeType: Record<(typeof INVENTORY_IMAGE_ACCEPTED_MIME_TYPES)[number], string> =
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

  const extension = extensionByMimeType[file.type as keyof typeof extensionByMimeType];
  if (!extension) {
    throw new InventoryImageUploadError("Upload a JPG, PNG, or WEBP image.");
  }

  const filename = `${INVENTORY_IMAGE_PATH_PREFIX}${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const blob = await put(filename, file, {
    access: "public",
    contentType: file.type,
  });

  return blob.url;
}

export async function deleteManagedInventoryImage(imageUrl?: string | null) {
  if (!isManagedInventoryImageUrl(imageUrl)) return;
  try {
    await del(imageUrl!);
  } catch {
    // best-effort delete — don't fail the caller if the blob is already gone
  }
}
