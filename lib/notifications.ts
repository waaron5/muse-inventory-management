import { prisma } from "@/lib/db";
import { getGiftReservationStatusLabel, getGiftReservationStatusVariant } from "@/lib/gift-reservation-ui";
import { getInventoryReservationStatusLabel } from "@/lib/inventory-reservation-ui";

type NotificationStatusVariant =
  | "active"
  | "pending"
  | "approved"
  | "rejected"
  | "canceled"
  | "completed"
  | "consumed";

export interface DashboardNotification {
  id: string;
  section: "attention" | "updates";
  timestamp: Date;
  href: string;
  category: "Inventory" | "Gifting";
  statusVariant: NotificationStatusVariant;
  statusLabel: string;
  title: string;
  message: string;
  meta: string;
  actionLabel: string;
}

export interface NotificationIndicator {
  notificationsHasAttention: boolean;
  latestNotificationAt: string | null;
}

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(startDate: Date, endDate: Date) {
  return `${startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function getInventoryNotificationVariant(status: string): NotificationStatusVariant {
  switch (status) {
    case "APPROVED":
      return "approved";
    case "REJECTED":
      return "rejected";
    case "CANCELED":
      return "canceled";
    case "COMPLETED":
      return "completed";
    default:
      return "pending";
  }
}

function getLatestDate(...dates: Array<Date | null | undefined>) {
  return dates.reduce<Date | null>((latest, current) => {
    if (!current) return latest;
    if (!latest) return current;
    return current.getTime() > latest.getTime() ? current : latest;
  }, null);
}

function getDisplayName(name: string | null | undefined) {
  return name?.trim() || "A team member";
}

export function getFirstName(name: string | null | undefined, email: string | null | undefined) {
  return (
    name?.trim().split(/\s+/)[0] ||
    email?.split("@")[0] ||
    "there"
  );
}

export async function getNotificationIndicator({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}): Promise<NotificationIndicator> {
  const todayStart = getTodayStart();

  if (isAdmin) {
    const [latestPendingInventory, latestPendingGift, latestAwaitingReturn] =
      await Promise.all([
        prisma.inventoryReservation.findFirst({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.giftReservation.findFirst({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.inventoryReservation.findFirst({
          where: {
            status: "APPROVED",
            event: { endDate: { lt: todayStart } },
          },
          orderBy: { event: { endDate: "desc" } },
          select: {
            event: { select: { endDate: true } },
          },
        }),
      ]);

    const latestNotificationAt = getLatestDate(
      latestPendingInventory?.createdAt,
      latestPendingGift?.createdAt,
      latestAwaitingReturn?.event.endDate
    );

    return {
      notificationsHasAttention: Boolean(
        latestPendingInventory || latestPendingGift || latestAwaitingReturn
      ),
      latestNotificationAt: latestNotificationAt?.toISOString() ?? null,
    };
  }

  const [latestInventoryUpdate, latestGiftUpdate, latestReturnReminder] =
    await Promise.all([
      prisma.inventoryReservation.findFirst({
        where: {
          requestedById: userId,
          lastModifiedById: { not: userId },
          OR: [
            { status: { in: ["REJECTED", "CANCELED", "COMPLETED"] } },
            {
              status: "APPROVED",
              event: { endDate: { gte: todayStart } },
            },
          ],
        },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.giftReservation.findFirst({
        where: {
          requestedById: userId,
          status: { in: ["APPROVED", "REJECTED", "COMPLETED"] },
          lastModifiedById: { not: userId },
        },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.inventoryReservation.findFirst({
        where: {
          requestedById: userId,
          status: "APPROVED",
          event: { endDate: { lt: todayStart } },
        },
        orderBy: { event: { endDate: "desc" } },
        select: {
          event: { select: { endDate: true } },
        },
      }),
    ]);

  const latestNotificationAt = getLatestDate(
    latestInventoryUpdate?.updatedAt,
    latestGiftUpdate?.updatedAt,
    latestReturnReminder?.event.endDate
  );

  return {
    notificationsHasAttention: Boolean(latestReturnReminder),
    latestNotificationAt: latestNotificationAt?.toISOString() ?? null,
  };
}

export async function getDashboardNotifications({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const todayStart = getTodayStart();

  if (isAdmin) {
    const [pendingInventoryReservations, pendingGiftReservations, awaitingReturns] =
      await Promise.all([
        prisma.inventoryReservation.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          include: {
            inventoryItem: {
              select: {
                title: true,
              },
            },
            event: {
              select: {
                eventName: true,
                companyName: true,
                startDate: true,
                endDate: true,
              },
            },
            requestedBy: {
              select: {
                name: true,
              },
            },
          },
        }),
        prisma.giftReservation.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          include: {
            giftItem: {
              select: {
                id: true,
                title: true,
              },
            },
            event: {
              select: {
                eventName: true,
                companyName: true,
                startDate: true,
                endDate: true,
              },
            },
            requestedBy: {
              select: {
                name: true,
              },
            },
          },
        }),
        prisma.inventoryReservation.findMany({
          where: {
            status: "APPROVED",
            event: { endDate: { lt: todayStart } },
          },
          orderBy: { event: { endDate: "desc" } },
          include: {
            inventoryItem: {
              select: {
                title: true,
              },
            },
            event: {
              select: {
                eventName: true,
                companyName: true,
                endDate: true,
              },
            },
            requestedBy: {
              select: {
                name: true,
              },
            },
          },
        }),
      ]);

    const notifications: DashboardNotification[] = [
      ...pendingInventoryReservations.map((reservation) => ({
        id: `inventory-pending-${reservation.id}`,
        section: "attention" as const,
        timestamp: reservation.createdAt,
        href: "/reservations",
        category: "Inventory" as const,
        statusVariant: "pending" as const,
        statusLabel: "New Request",
        title: "New inventory request",
        message: `${getDisplayName(reservation.requestedBy.name)} requested ${reservation.quantity}x "${reservation.inventoryItem.title}" for "${reservation.event.eventName}".`,
        meta: `${reservation.event.companyName} • ${formatDateRange(
          reservation.event.startDate,
          reservation.event.endDate
        )}`,
        actionLabel: "Review in reservations",
      })),
      ...pendingGiftReservations.map((reservation) => ({
        id: `gift-pending-${reservation.id}`,
        section: "attention" as const,
        timestamp: reservation.createdAt,
        href: `/gifting/${reservation.giftItem.id}`,
        category: "Gifting" as const,
        statusVariant: "pending" as const,
        statusLabel: "New Request",
        title: "New gift request",
        message: `${getDisplayName(reservation.requestedBy.name)} requested ${reservation.quantity}x "${reservation.giftItem.title}" for "${reservation.event.eventName}".`,
        meta: `${reservation.event.companyName} • ${formatDateRange(
          reservation.event.startDate,
          reservation.event.endDate
        )}`,
        actionLabel: "Open gift item",
      })),
      ...awaitingReturns.map((reservation) => ({
        id: `inventory-return-${reservation.id}`,
        section: "attention" as const,
        timestamp: reservation.event.endDate,
        href: "/reservations",
        category: "Inventory" as const,
        statusVariant: "pending" as const,
        statusLabel: "Awaiting Return",
        title: "Inventory awaiting return",
        message: `"${reservation.inventoryItem.title}" from "${reservation.event.eventName}" has not been returned yet.`,
        meta: `${getDisplayName(reservation.requestedBy.name)} • Event ended ${formatDate(
          reservation.event.endDate
        )}`,
        actionLabel: "Open reservations",
      })),
    ];

    return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  const [inventoryUpdates, giftUpdates, returnReminders] = await Promise.all([
    prisma.inventoryReservation.findMany({
      where: {
        requestedById: userId,
        lastModifiedById: { not: userId },
        OR: [
          { status: { in: ["REJECTED", "CANCELED", "COMPLETED"] } },
          {
            status: "APPROVED",
            event: { endDate: { gte: todayStart } },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        inventoryItem: {
          select: {
            title: true,
          },
        },
        event: {
          select: {
            eventName: true,
            companyName: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    }),
    prisma.giftReservation.findMany({
      where: {
        requestedById: userId,
        status: { in: ["APPROVED", "REJECTED", "COMPLETED"] },
        lastModifiedById: { not: userId },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        giftItem: {
          select: {
            id: true,
            title: true,
          },
        },
        event: {
          select: {
            eventName: true,
            companyName: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    }),
    prisma.inventoryReservation.findMany({
      where: {
        requestedById: userId,
        status: "APPROVED",
        event: { endDate: { lt: todayStart } },
      },
      orderBy: { event: { endDate: "desc" } },
      include: {
        inventoryItem: {
          select: {
            title: true,
          },
        },
        event: {
          select: {
            eventName: true,
            companyName: true,
            endDate: true,
          },
        },
      },
    }),
  ]);

  const notifications: DashboardNotification[] = [
    ...returnReminders.map((reservation) => ({
      id: `inventory-reminder-${reservation.id}`,
      section: "attention" as const,
      timestamp: reservation.event.endDate,
      href: "/reservations",
      category: "Inventory" as const,
      statusVariant: "pending" as const,
      statusLabel: "Action Needed",
      title: "Return reminder",
      message: `Return "${reservation.inventoryItem.title}" from "${reservation.event.eventName}".`,
      meta: `${reservation.event.companyName} • Event ended ${formatDate(
        reservation.event.endDate
      )}`,
      actionLabel: "Open reservations",
    })),
    ...inventoryUpdates.map((reservation) => ({
      id: `inventory-update-${reservation.id}`,
      section: "updates" as const,
      timestamp: reservation.updatedAt,
      href: "/reservations",
      category: "Inventory" as const,
      statusVariant: getInventoryNotificationVariant(reservation.status),
      statusLabel: getInventoryReservationStatusLabel(reservation.status),
      title: `Inventory request ${getInventoryReservationStatusLabel(
        reservation.status
      ).toLowerCase()}`,
      message: `Your request for ${reservation.quantity}x "${reservation.inventoryItem.title}" for "${reservation.event.eventName}" was ${getInventoryReservationStatusLabel(
        reservation.status
      ).toLowerCase()}.`,
      meta: `${reservation.event.companyName} • Updated ${formatDate(
        reservation.updatedAt
      )}`,
      actionLabel: "Open reservations",
    })),
    ...giftUpdates.map((reservation) => ({
      id: `gift-update-${reservation.id}`,
      section: "updates" as const,
      timestamp: reservation.updatedAt,
      href: `/gifting/${reservation.giftItem.id}`,
      category: "Gifting" as const,
      statusVariant: getGiftReservationStatusVariant(reservation.status),
      statusLabel: getGiftReservationStatusLabel(reservation.status),
      title: `Gift request ${getGiftReservationStatusLabel(
        reservation.status
      ).toLowerCase()}`,
      message: `Your request for ${reservation.quantity}x "${reservation.giftItem.title}" for "${reservation.event.eventName}" was ${getGiftReservationStatusLabel(
        reservation.status
      ).toLowerCase()}.`,
      meta: `${reservation.event.companyName} • Updated ${formatDate(
        reservation.updatedAt
      )}`,
      actionLabel: "Open gift item",
    })),
  ];

  return notifications.sort((a, b) => {
    if (a.section !== b.section) {
      return a.section === "attention" ? -1 : 1;
    }

    return b.timestamp.getTime() - a.timestamp.getTime();
  });
}
