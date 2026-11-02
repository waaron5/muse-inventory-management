/** Current month counts as both the current and most recent occurrence. */
export function monthOccurrence(month: number, today: string, past = false) {
  const [year, current] = today.split("-").map(Number);
  const chosenYear = year + (past ? (month > current ? -1 : 0) : (month < current ? 1 : 0));
  return `${chosenYear}-${String(month).padStart(2, "0")}`;
}
