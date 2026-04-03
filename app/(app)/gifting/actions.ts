"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { GiftStatus } from "@prisma/client";
import { getGiftAvailableQty } from "@/lib/availability";

export async function checkGiftAvailability(
  giftItemId: string,
  eventId: string
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startDate: true, endDate: true },
  });
  if (!event) throw new Error("Event not found");

  return getGiftAvailableQty(giftItemId, event.startDate, event.endDate);
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

// ── Gift Item CRUD ──────────────────────────────────────────────────────────

export async function createGiftItem(formData: {
  title: string;
  description?: string;
  imageUrl?: string;
  quantity: number;
  notes?: string;
}) {
  const session = await requireAdmin();

  const item = await prisma.giftItem.create({
    data: { ...formData, createdById: session.user.id, updatedById: session.user.id },
  });

  await logAudit({
    entityType: "GIFT_ITEM",
    entityId: item.id,
    actionType: "CREATED",
    performedById: session.user.id,
    summary: `Created gift item "${item.title}"`,
  });

  revalidatePath("/gifting");
  return { success: true, id: item.id };
}

export async function updateGiftItem(
  id: string,
  formData: {
    title?: string;
    description?: string;
    imageUrl?: string;
    quantity?: number;
    notes?: string;
  }
) {
  const session = await requireAdmin();

  const item = await prisma.giftItem.update({
    where: { id },
    data: { ...formData, updatedById: session.user.id },
  });

  await logAudit({
    entityType: "GIFT_ITEM",
    entityId: id,
    actionType: "UPDATED",
    performedById: session.user.id,
    summary: `Updated gift item "${item.title}"`,
  });

  revalidatePath("/gifting");
  revalidatePath(`/gifting/${id}`);
  return { success: true };
}

export async function consumeGiftItem(id: string) {
  const session = await requireAdmin();

  const item = await prisma.giftItem.update({
    where: { id },
    data: { status: GiftStatus.CONSUMED, updatedById: session.user.id },
  });

  await logAudit({
    entityType: "GIFT_ITEM",
    entityId: id,
    actionType: "CONSUMED",
    performedById: session.user.id,
    summary: `Marked gift item "${item.title}" as consumed`,
  });

  revalidatePath("/gifting");
  revalidatePath(`/gifting/${id}`);
  return { success: true };
}

export async function activateGiftItem(id: string) {
  const session = await requireAdmin();

  const item = await prisma.giftItem.update({
    where: { id },
    data: { status: GiftStatus.ACTIVE, updatedById: session.user.id },
  });

  await logAudit({
    entityType: "GIFT_ITEM",
    entityId: id,
    actionType: "ACTIVATED",
    performedById: session.user.id,
    summary: `Re-activated gift item "${item.title}"`,
  });

  revalidatePath("/gifting");
  revalidatePath(`/gifting/${id}`);
  return { success: true };
}

// ── Gift Reservations ────────────────────────────────────────────────────────

export async function createGiftReservation(formData: {
  giftItemId: string;
  eventId: string;
  quantity: number;
  notes?: string;
}) {
  const session = await requireSession();

  const event = await prisma.event.findUnique({
    where: { id: formData.eventId },
    select: { startDate: true, endDate: true, eventName: true },
  });

  if (!event) throw new Error("Event not found");

  const available = await getGiftAvailableQty(
    formData.giftItemId,
    event.startDate,
    event.endDate
  );

  if (formData.quantity > available) {
    throw new Error(`Only ${available} unit(s) available for that event window.`);
  }

  const reservation = await prisma.giftReservation.create({
    data: {
      giftItemId: formData.giftItemId,
      eventId: formData.eventId,
      quantity: formData.quantity,
      notes: formData.notes,
      requestedById: session.user.id,
      lastModifiedById: session.user.id,
    },
    include: {
      giftItem: { select: { title: true } },
      event: { select: { eventName: true } },
    },
  });

  await logAudit({
    entityType: "GIFT_RESERVATION",
    entityId: reservation.id,
    actionType: "CREATED",
    performedById: session.user.id,
    summary: `Reserved ${formData.quantity}x "${reservation.giftItem.title}" for event "${reservation.event.eventName}"`,
  });

  revalidatePath("/gifting");
  revalidatePath(`/gifting/${formData.giftItemId}`);
  revalidatePath("/dashboard");
  return { success: true, id: reservation.id };
}

export async function approveGiftReservation(id: string) {
  const session = await requireAdmin();

  const reservation = await prisma.giftReservation.findUnique({
    where: { id },
    include: { event: true, giftItem: true },
  });

  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "PENDING") throw new Error("Reservation is not pending");

  const available = await getGiftAvailableQty(
    reservation.giftItemId,
    reservation.event.startDate,
    reservation.event.endDate,
    id
  );

  if (reservation.quantity > available) {
    throw new Error(`Insufficient availability: only ${available} unit(s) available now.`);
  }

  await prisma.giftReservation.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: session.user.id,
      lastModifiedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "GIFT_RESERVATION",
    entityId: id,
    actionType: "APPROVED",
    performedById: session.user.id,
    summary: `Approved gift reservation for ${reservation.quantity}x "${reservation.giftItem.title}"`,
  });

  revalidatePath("/gifting");
  revalidatePath(`/gifting/${reservation.giftItemId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function rejectGiftReservation(id: string) {
  const session = await requireAdmin();

  const reservation = await prisma.giftReservation.findUnique({
    where: { id },
    include: { giftItem: true },
  });

  if (!reservation) throw new Error("Reservation not found");

  await prisma.giftReservation.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: session.user.id,
      lastModifiedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "GIFT_RESERVATION",
    entityId: id,
    actionType: "REJECTED",
    performedById: session.user.id,
    summary: `Rejected gift reservation for "${reservation.giftItem.title}"`,
  });

  revalidatePath("/gifting");
  revalidatePath(`/gifting/${reservation.giftItemId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function completeGiftReservation(id: string) {
  const session = await requireAdmin();

  const reservation = await prisma.giftReservation.findUnique({
    where: { id },
    include: { giftItem: true },
  });

  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "APPROVED") throw new Error("Only approved reservations can be marked complete");

  await prisma.giftReservation.update({
    where: { id },
    data: {
      status: "COMPLETED",
      lastModifiedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "GIFT_RESERVATION",
    entityId: id,
    actionType: "CONSUMED",
    performedById: session.user.id,
    summary: `Marked gift reservation for "${reservation.giftItem.title}" as consumed/complete`,
  });

  revalidatePath("/gifting");
  revalidatePath(`/gifting/${reservation.giftItemId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
