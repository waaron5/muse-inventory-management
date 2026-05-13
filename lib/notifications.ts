import { prisma } from "@/lib/db";
import {
  getGiftReservationStatusLabel,
  getGiftReservationStatusVariant,
} from "@/lib/gift-reservation-ui";
import { getInventoryReservationStatusLabel } from "@/lib/inventory-reservation-ui";
import { getTodayStart, formatAuditDate, formatDateRange } from "@/lib/date-utils";

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
  description: string;
  requesterName?: string;
  meta: string;
  primaryAction?:
    | {
        type: "approveInventory";
        reservationId: string;
        label: string;
      }
    | {
        type: "approveGift";
        reservationId: string;
        label: string;
      }
    | {
        type: "open";
        href: string;
        label: string;
      };
}

export interface NotificationIndicator {
  notificationsHasAttention: boolean;
  latestNotificationAt: string | null;
}

function formatDate(date: Date | null) {
  return date ? formatAuditDate(date.toISOString()) : "—";
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
  return name?.trim().split(/\s+/)[0] || email?.split("@")[0] || "there";
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
    const [latestPendingInventory, latestPendingGift, latestAwaitingReturn] = await Promise.all([
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
      latestAwaitingReturn?.event.endDate,
    );

    return {
      notificationsHasAttention: Boolean(
        latestPendingInventory || latestPendingGift || latestAwaitingReturn,
      ),
      latestNotificationAt: latestNotificationAt?.toISOString() ?? null,
    };
  }

  const [latestInventoryUpdate, latestGiftUpdate, latestReturnReminder] = await Promise.all([
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
    latestReturnReminder?.event.endDate,
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
        title: "Request",
        description: `${reservation.quantity}x "${reservation.inventoryItem.title}" for "${reservation.event.eventName}" is awaiting approval.`,
        requesterName: getDisplayName(reservation.requestedBy.name),
        meta: `${reservation.event.companyName} • ${formatDateRange(
          reservation.event.startDate,
          reservation.event.endDate,
        )}`,
        primaryAction: {
          type: "approveInventory" as const,
          reservationId: reservation.id,
          label: "Approve",
        },
      })),
      ...pendingGiftReservations.map((reservation) => ({
        id: `gift-pending-${reservation.id}`,
        section: "attention" as const,
        timestamp: reservation.createdAt,
        href: `/gifting/${reservation.giftItem.id}`,
        category: "Gifting" as const,
        statusVariant: "pending" as const,
        statusLabel: "New Request",
        title: "Request",
        description: `${reservation.quantity}x "${reservation.giftItem.title}" for "${reservation.event.eventName}" is awaiting approval.`,
        requesterName: getDisplayName(reservation.requestedBy.name),
        meta: `${reservation.event.companyName} • ${formatDateRange(
          reservation.event.startDate,
          reservation.event.endDate,
        )}`,
        primaryAction: {
          type: "approveGift" as const,
          reservationId: reservation.id,
          label: "Approve",
        },
      })),
      ...awaitingReturns.map((reservation) => ({
        id: `inventory-return-${reservation.id}`,
        section: "attention" as const,
        timestamp: reservation.event.endDate ?? reservation.updatedAt,
        href: "/reservations",
        category: "Inventory" as const,
        statusVariant: "pending" as const,
        statusLabel: "Awaiting Return",
        title: "Return",
        description: `"${reservation.inventoryItem.title}" from "${reservation.event.eventName}" still needs to be checked back in.`,
        meta: `${getDisplayName(reservation.requestedBy.name)} • Event ended ${formatDate(
          reservation.event.endDate,
        )}`,
        primaryAction: {
          type: "open" as const,
          href: "/reservations",
          label: "Open reservations",
        },
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
      timestamp: reservation.event.endDate ?? reservation.updatedAt,
      href: "/reservations",
      category: "Inventory" as const,
      statusVariant: "pending" as const,
      statusLabel: "Action Needed",
      title: "Return",
      description: `Return "${reservation.inventoryItem.title}" from "${reservation.event.eventName}".`,
      meta: `${reservation.event.companyName} • Event ended ${formatDate(
        reservation.event.endDate,
      )}`,
      primaryAction: {
        type: "open" as const,
        href: "/reservations",
        label: "Open reservations",
      },
    })),
    ...inventoryUpdates.map((reservation) => ({
      id: `inventory-update-${reservation.id}`,
      section: "updates" as const,
      timestamp: reservation.updatedAt,
      href: "/reservations",
      category: "Inventory" as const,
      statusVariant: getInventoryNotificationVariant(reservation.status),
      statusLabel: getInventoryReservationStatusLabel(reservation.status),
      title: "Reservation",
      description: `Your request for ${reservation.quantity}x "${reservation.inventoryItem.title}" for "${reservation.event.eventName}" was ${getInventoryReservationStatusLabel(
        reservation.status,
      ).toLowerCase()}.`,
      meta: `${reservation.event.companyName} • Updated ${formatDate(reservation.updatedAt)}`,
    })),
    ...giftUpdates.map((reservation) => ({
      id: `gift-update-${reservation.id}`,
      section: "updates" as const,
      timestamp: reservation.updatedAt,
      href: `/gifting/${reservation.giftItem.id}`,
      category: "Gifting" as const,
      statusVariant: getGiftReservationStatusVariant(reservation.status),
      statusLabel: getGiftReservationStatusLabel(reservation.status),
      title: "Reservation",
      description: `Your request for ${reservation.quantity}x "${reservation.giftItem.title}" for "${reservation.event.eventName}" was ${getGiftReservationStatusLabel(
        reservation.status,
      ).toLowerCase()}.`,
      meta: `${reservation.event.companyName} • Updated ${formatDate(reservation.updatedAt)}`,
    })),
  ];

  return notifications.sort((a, b) => {
    if (a.section !== b.section) {
      return a.section === "attention" ? -1 : 1;
    }

    return b.timestamp.getTime() - a.timestamp.getTime();
  });
}
