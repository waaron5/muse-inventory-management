"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getInventoryAvailableQty } from "@/lib/availability";

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

export async function createInventoryReservation(formData: {
  inventoryItemId: string;
  eventId: string;
  quantity: number;
  notes?: string;
}) {
  const session = await requireSession();

  // Verify the event exists and get dates for availability check
  const event = await prisma.event.findUnique({
    where: { id: formData.eventId },
    select: { startDate: true, endDate: true, eventName: true },
  });

  if (!event) throw new Error("Event not found");

  // Check availability
  const available = await getInventoryAvailableQty(
    formData.inventoryItemId,
    event.startDate,
    event.endDate
  );

  if (formData.quantity > available) {
    throw new Error(
      `Only ${available} unit(s) available for that event window.`
    );
  }

  const reservation = await prisma.inventoryReservation.create({
    data: {
      inventoryItemId: formData.inventoryItemId,
      eventId: formData.eventId,
      quantity: formData.quantity,
      notes: formData.notes,
      requestedById: session.user.id,
      lastModifiedById: session.user.id,
    },
    include: {
      inventoryItem: { select: { title: true } },
      event: { select: { eventName: true } },
    },
  });

  await logAudit({
    entityType: "INVENTORY_RESERVATION",
    entityId: reservation.id,
    actionType: "CREATED",
    performedById: session.user.id,
    summary: `Reserved ${formData.quantity}x "${reservation.inventoryItem.title}" for event "${reservation.event.eventName}"`,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${formData.inventoryItemId}`);
  revalidatePath("/dashboard");
  return { success: true, id: reservation.id };
}

export async function approveInventoryReservation(id: string, notes?: string) {
  const session = await requireAdmin();

  // Re-check availability at approval time (concurrency safety)
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
      `Insufficient availability: only ${available} unit(s) available now.`
    );
  }

  await prisma.inventoryReservation.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: session.user.id,
      lastModifiedById: session.user.id,
      notes: notes ?? reservation.notes,
    },
  });

  await logAudit({
    entityType: "INVENTORY_RESERVATION",
    entityId: id,
    actionType: "APPROVED",
    performedById: session.user.id,
    summary: `Approved reservation for ${reservation.quantity}x "${reservation.inventoryItem.title}"`,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${reservation.inventoryItemId}`);
  revalidatePath("/dashboard");
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

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function cancelInventoryReservation(id: string) {
  const session = await requireSession();

  const reservation = await prisma.inventoryReservation.findUnique({
    where: { id },
    include: { inventoryItem: true },
  });

  if (!reservation) throw new Error("Reservation not found");

  // Only the requesting user (or admin) can cancel
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

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
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

  // Update reservation and update item's current location
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

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${reservation.inventoryItemId}`);
  revalidatePath("/dashboard");
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

  // Check availability for the new quantity (exclude current reservation)
  const available = await getInventoryAvailableQty(
    reservation.inventoryItemId,
    reservation.event.startDate,
    reservation.event.endDate,
    id
  );

  if (formData.quantity > available) {
    throw new Error(`Only ${available} unit(s) available.`);
  }

  // If was approved, revert to pending
  const newStatus =
    reservation.status === "APPROVED" ? "PENDING" : reservation.status;

  await prisma.inventoryReservation.update({
    where: { id },
    data: {
      quantity: formData.quantity,
      notes: formData.notes ?? reservation.notes,
      status: newStatus,
      lastModifiedById: session.user.id,
      // Clear approval if reverting to pending
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

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}
