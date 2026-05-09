"use server";

import { revalidatePath } from "next/cache";
import { GiftStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getGiftAvailableQty } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { deleteManagedInventoryImage } from "@/lib/inventory-image-storage";
import { requireStorageLocationName } from "@/lib/storage-locations";
import { requireSession, requireAdmin } from "@/lib/action-helpers";
import { getFirstName } from "@/lib/notifications";
import {
  sendEmail,
  getAdminEmailRecipients,
  buildNewGiftRequestEmail,
  buildGiftApprovedEmail,
  buildGiftRejectedEmail,
} from "@/lib/email";

function revalidateGiftViews(giftItemIds: string[], eventId?: string) {
  revalidatePath("/gifting");
  revalidatePath("/events");
  revalidatePath("/dashboard");

  if (eventId) {
    revalidatePath(`/events/${eventId}`);
  }

  for (const giftItemId of new Set(giftItemIds)) {
    revalidatePath(`/gifting/${giftItemId}`);
  }
}

// Gift availability is global (not event-scoped) — approved requests reduce
// total quantity regardless of event dates.
export async function checkGiftAvailability(giftItemId: string) {
  await requireSession();
  return getGiftAvailableQty(giftItemId);
}

export async function createGiftItem(formData: {
  title: string;
  description?: string;
  imageUrl?: string | null;
  quantity: number;
  currentLocation: string;
  notes?: string;
}) {
  const session = await requireAdmin();
  const currentLocation = await requireStorageLocationName(formData.currentLocation);

  const item = await prisma.giftItem.create({
    data: {
      ...formData,
      currentLocation,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "GIFT_ITEM",
    entityId: item.id,
    actionType: "CREATED",
    performedById: session.user.id,
    summary: `Created gift item "${item.title}"`,
  });

  revalidateGiftViews([item.id]);
  return { success: true, id: item.id };
}

export async function updateGiftItem(
  id: string,
  formData: {
    title?: string;
    description?: string;
    imageUrl?: string | null;
    quantity?: number;
    currentLocation: string;
    notes?: string;
  },
) {
  const session = await requireAdmin();
  const currentLocation = await requireStorageLocationName(formData.currentLocation);
  const existingItem = await prisma.giftItem.findUnique({
    where: { id },
    select: { imageUrl: true },
  });

  if (!existingItem) {
    throw new Error("Item not found");
  }

  const item = await prisma.giftItem.update({
    where: { id },
    data: {
      ...formData,
      currentLocation,
      updatedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "GIFT_ITEM",
    entityId: id,
    actionType: "UPDATED",
    performedById: session.user.id,
    summary: `Updated gift item "${item.title}"`,
  });

  if (existingItem.imageUrl && existingItem.imageUrl !== item.imageUrl) {
    try {
      await deleteManagedInventoryImage(existingItem.imageUrl);
    } catch (error) {
      console.error("Failed to remove replaced gift image", error);
    }
  }

  revalidateGiftViews([id]);
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

  revalidateGiftViews([id]);
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

  revalidateGiftViews([id]);
  return { success: true };
}

export async function createGiftReservation(formData: {
  giftItemId: string;
  eventId: string;
  quantity: number;
  notes?: string;
}) {
  const session = await requireSession();
  const autoApproved = session.user.role === "ADMIN";

  const event = await prisma.event.findUnique({
    where: { id: formData.eventId },
    select: { eventName: true, companyName: true },
  });

  if (!event) throw new Error("Event not found");

  const available = await getGiftAvailableQty(formData.giftItemId);

  if (formData.quantity > available) {
    throw new Error(`Only ${available} unit(s) available to use right now.`);
  }

  const reservation = await prisma.$transaction(async (tx) => {
    const created = await tx.giftReservation.create({
      data: {
        giftItemId: formData.giftItemId,
        eventId: formData.eventId,
        quantity: formData.quantity,
        notes: formData.notes,
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
        giftItem: { select: { title: true } },
        event: { select: { eventName: true } },
      },
    });

    if (autoApproved) {
      await tx.giftItem.update({
        where: { id: formData.giftItemId },
        data: { updatedById: session.user.id },
      });
    }

    return created;
  });

  await logAudit({
    entityType: "GIFT_RESERVATION",
    entityId: reservation.id,
    actionType: "CREATED",
    performedById: session.user.id,
    summary: `Requested ${formData.quantity}x "${reservation.giftItem.title}" for event "${reservation.event.eventName}"${autoApproved ? " (auto-approved)" : ""}`,
  });

  revalidateGiftViews([formData.giftItemId], formData.eventId);

  if (!autoApproved) {
    void (async () => {
      const adminEmails = await getAdminEmailRecipients();
      if (adminEmails.length > 0) {
        const { subject, html } = buildNewGiftRequestEmail({
          requesterName: session.user.name,
          itemTitle: reservation.giftItem.title,
          quantity: reservation.quantity,
          eventName: reservation.event.eventName,
          eventCompany: event.companyName,
        });
        await sendEmail({ to: adminEmails, subject, html });
      }
    })().catch((err) => console.error("Email dispatch failed:", err));
  }

  return { success: true, id: reservation.id, autoApproved };
}

export async function approveGiftReservation(id: string) {
  const session = await requireAdmin();

  const reservation = await prisma.giftReservation.findUnique({
    where: { id },
    include: {
      event: { select: { id: true, eventName: true } },
      giftItem: true,
      requestedBy: {
        select: { email: true, name: true, firstName: true, emailNotificationsEnabled: true },
      },
    },
  });

  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "PENDING") throw new Error("Request is not pending");

  const available = await getGiftAvailableQty(reservation.giftItemId, undefined, undefined, id);

  if (reservation.quantity > available) {
    throw new Error(`Only ${available} unit(s) available to approve now.`);
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
    summary: `Approved gift request for ${reservation.quantity}x "${reservation.giftItem.title}"`,
  });

  revalidateGiftViews([reservation.giftItemId], reservation.event.id);

  if (reservation.requestedBy.emailNotificationsEnabled) {
    const firstName = getFirstName(
      reservation.requestedBy.firstName ?? reservation.requestedBy.name,
      reservation.requestedBy.email,
    );
    const { subject, html } = buildGiftApprovedEmail({
      requesterFirstName: firstName,
      itemTitle: reservation.giftItem.title,
      quantity: reservation.quantity,
      eventName: reservation.event.eventName,
    });
    void sendEmail({ to: reservation.requestedBy.email, subject, html }).catch((err) =>
      console.error("Email dispatch failed:", err),
    );
  }

  return { success: true };
}

export async function rejectGiftReservation(id: string) {
  const session = await requireAdmin();

  const reservation = await prisma.giftReservation.findUnique({
    where: { id },
    include: {
      event: { select: { id: true, eventName: true } },
      giftItem: true,
      requestedBy: {
        select: { email: true, name: true, firstName: true, emailNotificationsEnabled: true },
      },
    },
  });

  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "PENDING") throw new Error("Only pending requests can be rejected");

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
    summary: `Rejected gift request for "${reservation.giftItem.title}"`,
  });

  revalidateGiftViews([reservation.giftItemId], reservation.event.id);

  if (reservation.requestedBy.emailNotificationsEnabled) {
    const firstName = getFirstName(
      reservation.requestedBy.firstName ?? reservation.requestedBy.name,
      reservation.requestedBy.email,
    );
    const { subject, html } = buildGiftRejectedEmail({
      requesterFirstName: firstName,
      itemTitle: reservation.giftItem.title,
      quantity: reservation.quantity,
      eventName: reservation.event.eventName,
    });
    void sendEmail({ to: reservation.requestedBy.email, subject, html }).catch((err) =>
      console.error("Email dispatch failed:", err),
    );
  }

  return { success: true };
}

export async function completeGiftReservation(id: string) {
  const session = await requireAdmin();

  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.giftReservation.findUnique({
      where: { id },
      include: {
        event: { select: { id: true, eventName: true } },
        giftItem: true,
      },
    });

    if (!reservation) throw new Error("Reservation not found");
    if (reservation.status !== "APPROVED") {
      throw new Error("Only approved requests can be marked used");
    }

    const remainingQuantity = Math.max(0, reservation.giftItem.quantity - reservation.quantity);

    await tx.giftReservation.update({
      where: { id },
      data: {
        status: "COMPLETED",
        lastModifiedById: session.user.id,
      },
    });

    const item = await tx.giftItem.update({
      where: { id: reservation.giftItemId },
      data: {
        quantity: remainingQuantity,
        status: remainingQuantity > 0 ? GiftStatus.ACTIVE : GiftStatus.CONSUMED,
        updatedById: session.user.id,
      },
    });

    return {
      reservation,
      item,
      remainingQuantity,
    };
  });

  await logAudit({
    entityType: "GIFT_RESERVATION",
    entityId: id,
    actionType: "CONSUMED",
    performedById: session.user.id,
    summary: `Marked ${result.reservation.quantity}x "${result.reservation.giftItem.title}" as used for event "${result.reservation.event.eventName}"`,
  });

  revalidateGiftViews([result.reservation.giftItemId], result.reservation.event.id);
  return {
    success: true,
    remainingQuantity: result.remainingQuantity,
    itemStatus: result.item.status,
  };
}
