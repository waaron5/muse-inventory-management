export async function uploadManagedItemImage(file: File) {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/inventory-images", {
    method: "POST",
    body,
  });

  const payload = (await response.json().catch(() => null)) as
    | { imageUrl?: string; error?: string }
    | null;

  if (!response.ok || !payload?.imageUrl) {
    throw new Error(payload?.error ?? "Unable to upload image.");
  }

  return payload.imageUrl;
}
