export const STORAGE_LOCATION_NAMES = [
  "JP Display",
  "Nancy",
  "Muse Storage Unit",
] as const;

export type StorageLocationName = (typeof STORAGE_LOCATION_NAMES)[number];

export function isStorageLocationName(
  value: string
): value is StorageLocationName {
  return STORAGE_LOCATION_NAMES.includes(value as StorageLocationName);
}
