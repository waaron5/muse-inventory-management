import { prisma } from "./db";

/**
 * Returns true if two date ranges overlap (inclusive of boundary dates).
 * Overlap condition: A.start <= B.end AND A.end >= B.start
 */
export function datesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

/**
 * Compute available quantity for an inventory item during a proposed event window.
 * Available = total quantity - sum of approved reservation quantities for overlapping events.
 *
 * Excludes a specific reservation ID from the count (for edit scenarios).
 */
export async function getInventoryAvailableQty(
  inventoryItemId: string,
  eventStart: Date,
  eventEnd: Date,
  excludeReservationId?: string
): Promise<number> {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: inventoryItemId },
    select: { quantity: true },
  });

  if (!item) return 0;

  // Get all approved reservations for this item
  const approvedReservations = await prisma.inventoryReservation.findMany({
    where: {
      inventoryItemId,
      status: "APPROVED",
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    include: {
      event: { select: { startDate: true, endDate: true } },
    },
  });

  // Sum quantities of reservations whose events overlap with the requested window
  const allocatedQty = approvedReservations
    .filter((r) =>
      datesOverlap(eventStart, eventEnd, r.event.startDate, r.event.endDate)
    )
    .reduce((sum, r) => sum + r.quantity, 0);

  return Math.max(0, item.quantity - allocatedQty);
}

/**
 * Compute available quantity for a gift item during a proposed event window.
 */
export async function getGiftAvailableQty(
  giftItemId: string,
  eventStart: Date,
  eventEnd: Date,
  excludeReservationId?: string
): Promise<number> {
  const item = await prisma.giftItem.findUnique({
    where: { id: giftItemId },
    select: { quantity: true },
  });

  if (!item) return 0;

  const approvedReservations = await prisma.giftReservation.findMany({
    where: {
      giftItemId,
      status: "APPROVED",
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    include: {
      event: { select: { startDate: true, endDate: true } },
    },
  });

  const allocatedQty = approvedReservations
    .filter((r) =>
      datesOverlap(eventStart, eventEnd, r.event.startDate, r.event.endDate)
    )
    .reduce((sum, r) => sum + r.quantity, 0);

  return Math.max(0, item.quantity - allocatedQty);
}

/**
 * Infer event status from dates.
 */
export function getEventStatus(
  startDate: Date,
  endDate: Date
): "past" | "current" | "future" {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  if (end < today) return "past";
  if (start <= today && end >= today) return "current";
  return "future";
}
