import { prisma } from "@/lib/db";
import { getStorageLocationNames } from "@/lib/storage-locations";

export type InventoryDetailData = NonNullable<Awaited<ReturnType<typeof getInventoryDetailData>>>;

export async function getInventoryDetailData(id: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, email: true } },
      updatedBy: { select: { name: true, email: true } },
      reservations: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          event: {
            select: {
              companyName: true,
              eventName: true,
              startDate: true,
              endDate: true,
            },
          },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!item) return null;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [auditLogs, availableEvents, returnLocationOptions] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "INVENTORY_ITEM", entityId: id },
      orderBy: { timestamp: "desc" },
      take: 20,
      include: { performedBy: { select: { name: true } } },
    }),
    prisma.event.findMany({
      where: { OR: [{ endDate: { gte: todayStart } }, { endDate: null }] },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        eventName: true,
        companyName: true,
        location: true,
        startDate: true,
        endDate: true,
      },
    }),
    getStorageLocationNames(),
  ]);

  const activeReservations = item.reservations.filter((reservation) =>
    ["PENDING", "APPROVED"].includes(reservation.status),
  );
  const reservationHistory = item.reservations.filter(
    (reservation) => !["PENDING", "APPROVED"].includes(reservation.status),
  );

  return {
    item: {
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      imageUrl: item.imageUrl ?? "",
      quantity: item.quantity,
      currentLocation: item.currentLocation ?? "",
      status: item.status,
      notes: item.notes ?? "",
      createdByName: item.createdBy?.name ?? null,
      updatedByName: item.updatedBy?.name ?? null,
      updatedAt: item.updatedAt.toISOString(),
    },
    activeReservations: activeReservations.map((reservation) => ({
      id: reservation.id,
      eventId: reservation.eventId,
      eventName: reservation.event.eventName,
      eventCompanyName: reservation.event.companyName,
      eventStartDate: reservation.event.startDate?.toISOString() ?? null,
      eventEndDate: reservation.event.endDate?.toISOString() ?? null,
      quantity: reservation.quantity,
      status: reservation.status,
      requestedById: reservation.requestedBy.id,
      requestedByName: reservation.requestedBy.name,
    })),
    reservationHistory: reservationHistory.map((reservation) => ({
      id: reservation.id,
      eventName: reservation.event.eventName,
      eventCompanyName: reservation.event.companyName,
      eventStartDate: reservation.event.startDate?.toISOString() ?? null,
      eventEndDate: reservation.event.endDate?.toISOString() ?? null,
      quantity: reservation.quantity,
      status: reservation.status,
      requestedByName: reservation.requestedBy.name,
      approvedByName: reservation.approvedBy?.name ?? null,
      notes: reservation.notes ?? "",
    })),
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      actionType: log.actionType,
      performedByName: log.performedBy.name,
      timestamp: log.timestamp.toISOString(),
      summary: log.summary,
    })),
    availableEvents: availableEvents.map((event) => ({
      id: event.id,
      eventName: event.eventName,
      companyName: event.companyName,
      location: event.location,
      startDate: event.startDate?.toISOString() ?? null,
      endDate: event.endDate?.toISOString() ?? null,
    })),
    returnLocationOptions,
  };
}
