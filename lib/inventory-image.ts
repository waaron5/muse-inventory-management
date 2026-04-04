export const INVENTORY_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const INVENTORY_IMAGE_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const INVENTORY_IMAGE_ACCEPT_ATTRIBUTE =
  INVENTORY_IMAGE_ACCEPTED_MIME_TYPES.join(",");

export const INVENTORY_IMAGE_REQUIREMENTS_TEXT = "JPG, PNG, or WEBP, 10MB max";

export function validateInventoryImageFile(file: Pick<File, "size" | "type">) {
  if (!INVENTORY_IMAGE_ACCEPTED_MIME_TYPES.includes(file.type as (typeof INVENTORY_IMAGE_ACCEPTED_MIME_TYPES)[number])) {
    return "Upload a JPG, PNG, or WEBP image.";
  }

  if (file.size > INVENTORY_IMAGE_MAX_BYTES) {
    return "Image must be 10MB or smaller.";
  }

  return null;
}
