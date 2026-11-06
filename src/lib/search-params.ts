/** A page's `searchParams` as the query they came from, repeated keys and all. */
export function asSearchParams(record: Record<string, string | string[] | undefined>) {
  return new URLSearchParams(Object.entries(record).flatMap(([key, value]) => [value ?? []].flat().map((v) => [key, v])));
}
