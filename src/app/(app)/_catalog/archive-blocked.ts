// Why an item can't be Archived yet, in a word or two, on its page and its
// row: it has Stock, or an Event still holds it. The command has the last word.
export function archiveBlocked(count: number, reserved: boolean) {
  if (count > 0) return `${count} in storage`;
  if (reserved) return "Reserved";
  return undefined;
}
