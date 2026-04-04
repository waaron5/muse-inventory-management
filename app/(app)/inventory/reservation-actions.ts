"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getInventoryAvailableQty } from "@/lib/availability";

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function revalidateInventoryReservationViews(itemIds: string[], eventId: string) {
  revalidatePath("/inventory");
  revalidatePath("/events");
  revalidatePath("/reservations");
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");

  for (const itemId of new Set(itemIds)) {
    revalidatePath(`/inventory/${itemId}`);
  }
}

export async function checkInventoryAvailability(
  inventoryItemId: string,
  eventId: string
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startDate: true, endDate: true },
  });
  if (!event) throw new Error("Event not found");

  return getInventoryAvailableQty(
    inventoryItemId,
    event.startDate,
    event.endDate
  );
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");
  return session;
}

async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

export async function searchReservableInventoryItems(query: string) {
  await requireSession();

  const term = query.trim();

  const items = await prisma.inventoryItem.findMany({
    where: {
      status: "ACTIVE",
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: "insensitive" } },
              { description: { contains: term, mode: "insensitive" } },
              { currentLocation: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      currentLocation: true,
      quantity: true,
    },
    orderBy: { title: "asc" },
    take: term ? 8 : 6,
  });

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    currentLocation: item.currentLocation,
    totalQuantity: item.quantity,
  }));
}

export async function createInventoryReservationsBatch(formData: {
  eventId: string;
  items: Array<{
    inventoryItemId: string;
    quantity: number;
    notes?: string;
  }>;
}) {
  const session = await requireSession();
  const autoApproved = session.user.role === "ADMIN";

  if (formData.items.length === 0) {
    throw new Error("Add at least one inventory item before reserving.");
  }

  const event = await prisma.event.findUnique({
    where: { id: formData.eventId },
    select: { startDate: true, endDate: true, eventName: true },
  });

  if (!event) throw new Error("Event not found");
  if (event.endDate < getTodayStart()) {
    throw new Error("Cannot reserve inventory for a past event.");
  }

  const normalizedItems = formData.items.map((item) => {
    const quantity = Math.floor(item.quantity);
    if (!item.inventoryItemId) {
      throw new Error("Inventory item is required.");
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error("Reservation quantities must be at least 1.");
    }

    return {
      inventoryItemId: item.inventoryItemId,
      quantity,
      notes: item.notes?.trim() || undefined,
    };
  });

  const itemIds = normalizedItems.map((item) => item.inventoryItemId);
  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("Each inventory item can only be added once per reservation request.");
  }

  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds } },
    select: {
      id: true,
      title: true,
      status: true,
    },
  });

  const itemMap = new Map(inventoryItems.map((item) => [item.id, item]));
  const existingActiveReservations = await prisma.inventoryReservation.findMany({
    where: {
      eventId: formData.eventId,
      requestedById: session.user.id,
      inventoryItemId: { in: itemIds },
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: {
      id: true,
      inventoryItemId: true,
      quantity: true,
      status: true,
      approvedById: true,
      notes: true,
    },
    orderBy: [{ inventoryItemId: "asc" }, { createdAt: "asc" }],
  });
  const existingReservationsByItemId = new Map<
    string,
    typeof existingActiveReservations
  >();

  for (const reservation of existingActiveReservations) {
    const reservationsForItem =
      existingReservationsByItemId.get(reservation.inventoryItemId) ?? [];
    reservationsForItem.push(reservation);
    existingReservationsByItemId.set(
      reservation.inventoryItemId,
      reservationsForItem
    );
  }

  for (const item of normalizedItems) {
    const inventoryItem = itemMap.get(item.inventoryItemId);
    if (!inventoryItem) throw new Error("One or more inventory items could not be found.");
    if (inventoryItem.status !== "ACTIVE") {
      throw new Error(`"${inventoryItem.title}" is not available for new reservations.`);
    }

    const existingReservations =
      existingReservationsByItemId.get(item.inventoryItemId) ?? [];
    const existingApprovedReservationIds = existingReservations
      .filter((reservation) => reservation.status === "APPROVED")
      .map((reservation) => reservation.id);
    const requestedTotalQuantity =
      existingReservations.reduce(
        (sum, reservation) => sum + reservation.quantity,
        0
      ) + item.quantity;
    const available = await getInventoryAvailableQty(
      item.inventoryItemId,
      event.startDate,
      event.endDate,
      existingApprovedReservationIds
    );

    if (requestedTotalQuantity > available) {
      throw new Error(`Only ${available} unit(s) of "${inventoryItem.title}" are available for that event window.`);
    }
  }

  const reservations = await prisma.$transaction(async (tx) => {
    const created = await Promise.all(
      normalizedItems.map(async (item) => {
        const existingReservations =
          existingReservationsByItemId.get(item.inventoryItemId) ?? [];
        const [primaryReservation, ...duplicateReservations] = existingReservations;
        const existingQuantity = existingReservations.reduce(
          (sum, reservation) => sum + reservation.quantity,
          0
        );
        const nextQuantity = existingQuantity + item.quantity;
        const hadApprovedReservation = existingReservations.some(
          (reservation) => reservation.status === "APPROVED"
        );

        if (primaryReservation) {
          const updatedReservation = await tx.inventoryReservation.update({
            where: { id: primaryReservation.id },
            data: {
              quantity: nextQuantity,
              notes: item.notes ?? primaryReservation.notes,
              status: autoApproved ? "APPROVED" : "PENDING",
              lastModifiedById: session.user.id,
              approvedById: autoApproved ? session.user.id : null,
            },
            include: {
              inventoryItem: { select: { title: true } },
              event: { select: { eventName: true } },
            },
          });

          if (duplicateReservations.length > 0) {
            await tx.inventoryReservation.updateMany({
              where: {
                id: {
                  in: duplicateReservations.map((reservation) => reservation.id),
                },
              },
              data: {
                status: "CANCELED",
                lastModifiedById: session.user.id,
              },
            });
          }

          return {
            ...updatedReservation,
            action: "merged" as const,
            previousQuantity: existingQuantity,
            revertedToPending: !autoApproved && hadApprovedReservation,
            mergedDuplicateIds: duplicateReservations.map(
              (reservation) => reservation.id
            ),
          };
        }

        const newReservation = await tx.inventoryReservation.create({
          data: {
            inventoryItemId: item.inventoryItemId,
            eventId: formData.eventId,
            quantity: item.quantity,
            notes: item.notes,
            requestedById: session.user.id,
            lastModifiedById: session.user.id,
            ...(autoApproved
              ? {
                  status: "APPROVED",
                  approvedById: session.user.id,
                }
              : {}),
          },
          include: {
            inventoryItem: { select: { title: true } },
            event: { select: { eventName: true } },
          },
        });

        return {
          ...newReservation,
          action: "created" as const,
          previousQuantity: 0,
          revertedToPending: false,
          mergedDuplicateIds: [] as string[],
        };
      })
    );

    if (autoApproved) {
      await Promise.all(
        [...new Set(itemIds)].map((itemId) =>
          tx.inventoryItem.update({
            where: { id: itemId },
            data: { updatedById: session.user.id },
          })
        )
      );
    }

    return created;
  });

  await Promise.all(
    reservations.flatMap((reservation) => {
      const primaryAudit = logAudit({
        entityType: "INVENTORY_RESERVATION",
        entityId: reservation.id,
        actionType: reservation.action === "created" ? "CREATED" : "UPDATED",
        performedById: session.user.id,
        summary:
          reservation.action === "created"
            ? `Reserved ${reservation.quantity}x "${reservation.inventoryItem.title}" for event "${reservation.event.eventName}"${autoApproved ? " (auto-approved)" : ""}`
            : `Updated reservation for "${reservation.inventoryItem.title}" for event "${reservation.event.eventName}" — qty ${reservation.previousQuantity} → ${reservation.quantity}${reservation.revertedToPending ? " (pending approval again)" : ""}`,
      });

      const mergedDuplicateAudits = reservation.mergedDuplicateIds.map(
        (reservationId) =>
          logAudit({
            entityType: "INVENTORY_RESERVATION",
            entityId: reservationId,
            actionType: "CANCELED",
            performedById: session.user.id,
            summary: `Merged duplicate active reservation into "${reservation.inventoryItem.title}" for event "${reservation.event.eventName}"`,
          })
      );

      return [primaryAudit, ...mergedDuplicateAudits];
    })
  );

  const createdCount = reservations.filter(
    (reservation) => reservation.action === "created"
  ).length;
  const mergedCount = reservations.length - createdCount;
  const revertedToPendingCount = reservations.filter(
    (reservation) => reservation.revertedToPending
  ).length;

  revalidateInventoryReservationViews(itemIds, formData.eventId);
  return {
    success: true,
    count: reservations.length,
    ids: reservations.map((reservation) => reservation.id),
    autoApproved,
    createdCount,
    mergedCount,
    revertedToPendingCount,
  };
}

export async function createInventoryReservation(formData: {
  inventoryItemId: string;
  eventId: string;
  quantity: number;
  notes?: string;
}) {
  const result = await createInventoryReservationsBatch({
    eventId: formData.eventId,
    items: [
      {
        inventoryItemId: formData.inventoryItemId,
        quantity: formData.quantity,
        notes: formData.notes,
      },
    ],
  });

  return {
    success: result.success,
    id: result.ids[0],
    autoApproved: result.autoApproved,
  };
}

export async function approveInventoryReservation(id: string, notes?: string) {
  const session = await requireAdmin();

  const reservation = await prisma.inventoryReservation.findUnique({
    where: { id },
    include: { event: true, inventoryItem: true },
  });

  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "PENDING") throw new Error("Reservation is not pending");

  const available = await getInventoryAvailableQty(
    reservation.inventoryItemId,
    reservation.event.startDate,
    reservation.event.endDate,
    id
  );

  if (reservation.quantity > available) {
    throw new Error(
      `Insufficient availability: only ${available} unit(s) available for this event window now.`
    );
  }

  await prisma.$transaction([
    prisma.inventoryReservation.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: session.user.id,
        lastModifiedById: session.user.id,
        notes: notes ?? reservation.notes,
      },
    }),
    prisma.inventoryItem.update({
      where: { id: reservation.inventoryItemId },
      data: {
        updatedById: session.user.id,
      },
    }),
  ]);

  await logAudit({
    entityType: "INVENTORY_RESERVATION",
    entityId: id,
    actionType: "APPROVED",
    performedById: session.user.id,
    summary: `Approved reservation for ${reservation.quantity}x "${reservation.inventoryItem.title}"`,
  });

  revalidateInventoryReservationViews([reservation.inventoryItemId], reservation.eventId);
  return { success: true };
}

export async function rejectInventoryReservation(id: string, notes?: string) {
  const session = await requireAdmin();

  const reservation = await prisma.inventoryReservation.findUnique({
    where: { id },
    include: { inventoryItem: true },
  });

  if (!reservation) throw new Error("Reservation not found");

  await prisma.inventoryReservation.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: session.user.id,
      lastModifiedById: session.user.id,
      notes: notes ?? reservation.notes,
    },
  });

  await logAudit({
    entityType: "INVENTORY_RESERVATION",
    entityId: id,
    actionType: "REJECTED",
    performedById: session.user.id,
    summary: `Rejected reservation for "${reservation.inventoryItem.title}"`,
  });

  revalidateInventoryReservationViews([reservation.inventoryItemId], reservation.eventId);
  return { success: true };
}

export async function cancelInventoryReservation(id: string) {
  const session = await requireSession();

  const reservation = await prisma.inventoryReservation.findUnique({
    where: { id },
    include: { inventoryItem: true },
  });

  if (!reservation) throw new Error("Reservation not found");

  if (
    reservation.requestedById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    throw new Error("Forbidden");
  }

  if (!["PENDING", "APPROVED"].includes(reservation.status)) {
    throw new Error("Cannot cancel a reservation in this state");
  }

  await prisma.inventoryReservation.update({
    where: { id },
    data: {
      status: "CANCELED",
      lastModifiedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "INVENTORY_RESERVATION",
    entityId: id,
    actionType: "CANCELED",
    performedById: session.user.id,
    summary: `Canceled reservation for "${reservation.inventoryItem.title}"`,
  });

  revalidateInventoryReservationViews([reservation.inventoryItemId], reservation.eventId);
  return { success: true };
}

export async function returnInventoryReservation(
  id: string,
  returnLocation: string,
  notes?: string
) {
  const session = await requireSession();

  const reservation = await prisma.inventoryReservation.findUnique({
    where: { id },
    include: { inventoryItem: true },
  });

  if (!reservation) throw new Error("Reservation not found");

  if (
    reservation.requestedById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    throw new Error("Forbidden");
  }

  if (reservation.status !== "APPROVED") {
    throw new Error("Only approved reservations can be returned");
  }

  if (!returnLocation.trim()) {
    throw new Error("Return location is required");
  }

  await prisma.$transaction([
    prisma.inventoryReservation.update({
      where: { id },
      data: {
        status: "COMPLETED",
        returnLocation: returnLocation.trim(),
        notes: notes ?? reservation.notes,
        lastModifiedById: session.user.id,
      },
    }),
    prisma.inventoryItem.update({
      where: { id: reservation.inventoryItemId },
      data: {
        currentLocation: returnLocation.trim(),
        updatedById: session.user.id,
      },
    }),
  ]);

  await logAudit({
    entityType: "INVENTORY_RESERVATION",
    entityId: id,
    actionType: "RETURNED",
    performedById: session.user.id,
    summary: `Returned "${reservation.inventoryItem.title}" to "${returnLocation}"`,
    metadata: { returnLocation, notes },
  });

  revalidateInventoryReservationViews([reservation.inventoryItemId], reservation.eventId);
  return { success: true };
}

export async function editInventoryReservation(
  id: string,
  formData: { quantity: number; notes?: string }
) {
  const session = await requireSession();

  const reservation = await prisma.inventoryReservation.findUnique({
    where: { id },
    include: { event: true, inventoryItem: true },
  });

  if (!reservation) throw new Error("Reservation not found");

  if (
    reservation.requestedById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    throw new Error("Forbidden");
  }

  if (!["PENDING", "APPROVED"].includes(reservation.status)) {
    throw new Error("Cannot edit a reservation in this state");
  }

  const available = await getInventoryAvailableQty(
    reservation.inventoryItemId,
    reservation.event.startDate,
    reservation.event.endDate,
    id
  );

  if (formData.quantity > available) {
    throw new Error(`Only ${available} unit(s) available for this event.`);
  }

  const newStatus =
    reservation.status === "APPROVED" ? "PENDING" : reservation.status;

  await prisma.inventoryReservation.update({
    where: { id },
    data: {
      quantity: formData.quantity,
      notes: formData.notes ?? reservation.notes,
      status: newStatus,
      lastModifiedById: session.user.id,
      approvedById: newStatus === "PENDING" ? null : reservation.approvedById,
    },
  });

  await logAudit({
    entityType: "INVENTORY_RESERVATION",
    entityId: id,
    actionType: "UPDATED",
    performedById: session.user.id,
    summary: `Edited reservation for "${reservation.inventoryItem.title}" — qty ${formData.quantity}${newStatus === "PENDING" ? " (reverted to pending)" : ""}`,
  });

  revalidateInventoryReservationViews([reservation.inventoryItemId], reservation.eventId);
  return { success: true };
}

export async function bulkApproveInventoryReservations(ids: string[]) {
  const session = await requireAdmin();

  if (ids.length === 0) throw new Error("No reservations selected");

  const reservations = await prisma.inventoryReservation.findMany({
    where: { id: { in: ids }, status: "PENDING" },
    include: {
      event: { select: { startDate: true, endDate: true, eventName: true } },
      inventoryItem: { select: { title: true } },
    },
  });

  if (reservations.length === 0) {
    throw new Error("No pending reservations found for the selected IDs");
  }

  const results: { approved: number; failed: Array<{ id: string; item: string; reason: string }> } = {
    approved: 0,
    failed: [],
  };

  // Process sequentially so availability checks account for prior approvals in this batch
  for (const reservation of reservations) {
    const available = await getInventoryAvailableQty(
      reservation.inventoryItemId,
      reservation.event.startDate,
      reservation.event.endDate,
      reservation.id
    );

    if (reservation.quantity > available) {
      results.failed.push({
        id: reservation.id,
        item: reservation.inventoryItem.title,
        reason: `Only ${available} unit(s) available`,
      });
      continue;
    }

    await prisma.$transaction([
      prisma.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          status: "APPROVED",
          approvedById: session.user.id,
          lastModifiedById: session.user.id,
        },
      }),
      prisma.inventoryItem.update({
        where: { id: reservation.inventoryItemId },
        data: { updatedById: session.user.id },
      }),
    ]);

    await logAudit({
      entityType: "INVENTORY_RESERVATION",
      entityId: reservation.id,
      actionType: "APPROVED",
      performedById: session.user.id,
      summary: `Approved reservation for ${reservation.quantity}x "${reservation.inventoryItem.title}" (bulk)`,
    });

    results.approved++;
  }

  const allItemIds = reservations.map((r) => r.inventoryItemId);
  const allEventIds = [...new Set(reservations.map((r) => r.eventId))];
  for (const eventId of allEventIds) {
    revalidateInventoryReservationViews(allItemIds, eventId);
  }

  return results;
}
