import { getEventStatus } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { getStorageLocationNames } from "@/lib/storage-locations";

export type EventDetailData = NonNullable<Awaited<ReturnType<typeof getEventDetailData>>>;

export async function getEventDetailData(id: string, userId: string) {
  const [event, returnLocationOptions] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
        inventoryReservations: {
          orderBy: { createdAt: "desc" },
          include: {
            inventoryItem: { select: { title: true } },
            requestedBy: { select: { id: true, name: true } },
            approvedBy: { select: { name: true } },
          },
        },
        giftReservations: {
          orderBy: { createdAt: "desc" },
          include: {
            giftItem: { select: { title: true } },
            requestedBy: { select: { id: true, name: true } },
            approvedBy: { select: { name: true } },
          },
        },
      },
    }),
    getStorageLocationNames(),
  ]);

  if (!event) return null;

  const status = getEventStatus(event.startDate, event.endDate);
  const myPendingCount = event.inventoryReservations.filter(
    (reservation) => reservation.requestedById === userId && reservation.status === "PENDING",
  ).length;
  const myApprovedCount = event.inventoryReservations.filter(
    (reservation) => reservation.requestedById === userId && reservation.status === "APPROVED",
  ).length;

  return {
    event: {
      id: event.id,
      eventName: event.eventName,
      companyName: event.companyName,
      plCode: event.plCode ?? "",
      location: event.location ?? "",
      startDate: event.startDate?.toISOString() ?? null,
      endDate: event.endDate?.toISOString() ?? null,
      notes: event.notes ?? "",
      status,
      createdByName: event.createdBy?.name ?? null,
      updatedByName: event.updatedBy?.name ?? null,
      updatedAt: event.updatedAt.toISOString(),
    },
    reservationState: {
      pendingCount: myPendingCount,
      approvedCount: myApprovedCount,
    },
    inventoryReservations: event.inventoryReservations.map((reservation) => ({
      id: reservation.id,
      inventoryItemId: reservation.inventoryItemId,
      inventoryItemTitle: reservation.inventoryItem.title,
      requestedById: reservation.requestedById,
      requestedByName: reservation.requestedBy.name,
      eventName: event.eventName,
      quantity: reservation.quantity,
      status: reservation.status,
    })),
    giftReservations: event.giftReservations.map((reservation) => ({
      id: reservation.id,
      giftItemId: reservation.giftItemId,
      giftItemTitle: reservation.giftItem.title,
      requestedById: reservation.requestedById,
      requestedByName: reservation.requestedBy.name,
      quantity: reservation.quantity,
      status: reservation.status,
    })),
    returnLocationOptions,
  };
}
