import { prisma } from "@/lib/db";
import { isStorageLocationName, STORAGE_LOCATION_NAMES } from "@/lib/storage-location-options";

export async function getStorageLocationNames() {
  const locations = await prisma.storageLocation.findMany({
    select: { name: true },
  });

  const availableNames = new Set(
    locations.map((location) => location.name).filter(isStorageLocationName),
  );

  if (availableNames.size === 0) {
    return [...STORAGE_LOCATION_NAMES];
  }

  return STORAGE_LOCATION_NAMES.filter((name) => availableNames.has(name));
}

export async function requireStorageLocationName(value: string) {
  const trimmedValue = value.trim();

  if (!isStorageLocationName(trimmedValue)) {
    throw new Error("Choose a valid storage location");
  }

  const location = await prisma.storageLocation.findUnique({
    where: { name: trimmedValue },
    select: { name: true },
  });

  if (!location) {
    throw new Error("Choose a valid storage location");
  }

  return location.name;
}
