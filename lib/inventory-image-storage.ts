import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  INVENTORY_IMAGE_ACCEPTED_MIME_TYPES,
  INVENTORY_IMAGE_MAX_BYTES,
  validateInventoryImageFile,
} from "@/lib/inventory-image";

const INVENTORY_IMAGE_UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "inventory"
);
const INVENTORY_IMAGE_PUBLIC_PREFIX = "/uploads/inventory/";

const extensionByMimeType: Record<
  (typeof INVENTORY_IMAGE_ACCEPTED_MIME_TYPES)[number],
  string
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class InventoryImageUploadError extends Error {}

export function isManagedInventoryImageUrl(imageUrl?: string | null) {
  return Boolean(imageUrl?.startsWith(INVENTORY_IMAGE_PUBLIC_PREFIX));
}

export async function saveInventoryImageFile(file: File) {
  const validationError = validateInventoryImageFile(file);
  if (validationError) {
    throw new InventoryImageUploadError(validationError);
  }

  if (file.size > INVENTORY_IMAGE_MAX_BYTES) {
    throw new InventoryImageUploadError("Image must be 10MB or smaller.");
  }

  const extension =
    extensionByMimeType[file.type as keyof typeof extensionByMimeType];

  if (!extension) {
    throw new InventoryImageUploadError("Upload a JPG, PNG, or WEBP image.");
  }

  await mkdir(INVENTORY_IMAGE_UPLOAD_DIR, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  const filePath = path.join(INVENTORY_IMAGE_UPLOAD_DIR, fileName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await writeFile(filePath, fileBuffer);

  return `${INVENTORY_IMAGE_PUBLIC_PREFIX}${fileName}`;
}

export async function deleteManagedInventoryImage(imageUrl?: string | null) {
  if (!isManagedInventoryImageUrl(imageUrl)) {
    return;
  }

  const managedImageUrl = imageUrl;
  if (!managedImageUrl) {
    return;
  }

  const fileName = managedImageUrl.slice(INVENTORY_IMAGE_PUBLIC_PREFIX.length);
  if (!fileName || fileName.includes("/") || fileName.includes("\\")) {
    return;
  }

  const filePath = path.join(INVENTORY_IMAGE_UPLOAD_DIR, fileName);

  try {
    await unlink(filePath);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}
