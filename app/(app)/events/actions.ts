"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

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

export async function createEvent(formData: {
  companyName: string;
  eventName: string;
  location: string;
  startDate: string;
  endDate: string;
  notes?: string;
}) {
  const session = await requireAdmin();

  const event = await prisma.event.create({
    data: {
      companyName: formData.companyName,
      eventName: formData.eventName,
      location: formData.location,
      startDate: new Date(formData.startDate),
      endDate: new Date(formData.endDate),
      notes: formData.notes,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "EVENT",
    entityId: event.id,
    actionType: "CREATED",
    performedById: session.user.id,
    summary: `Created event "${event.eventName}" for ${event.companyName}`,
  });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  return { success: true, id: event.id };
}

export async function updateEvent(
  id: string,
  formData: {
    companyName?: string;
    eventName?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    notes?: string;
  }
) {
  const session = await requireAdmin();

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(formData.companyName ? { companyName: formData.companyName } : {}),
      ...(formData.eventName ? { eventName: formData.eventName } : {}),
      ...(formData.location ? { location: formData.location } : {}),
      ...(formData.startDate ? { startDate: new Date(formData.startDate) } : {}),
      ...(formData.endDate ? { endDate: new Date(formData.endDate) } : {}),
      ...(formData.notes !== undefined ? { notes: formData.notes } : {}),
      updatedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "EVENT",
    entityId: id,
    actionType: "UPDATED",
    performedById: session.user.id,
    summary: `Updated event "${event.eventName}"`,
  });

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteEvent(id: string) {
  const session = await requireAdmin();

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          inventoryReservations: { where: { status: { in: ["PENDING", "APPROVED"] } } },
          giftReservations: { where: { status: { in: ["PENDING", "APPROVED"] } } },
        },
      },
    },
  });

  if (!event) throw new Error("Event not found");

  const activeCount =
    event._count.inventoryReservations + event._count.giftReservations;

  if (activeCount > 0) {
    throw new Error(
      `Cannot delete event with ${activeCount} active reservation(s). Cancel or reject them first.`
    );
  }

  await logAudit({
    entityType: "EVENT",
    entityId: id,
    actionType: "DELETED",
    performedById: session.user.id,
    summary: `Deleted event "${event.eventName}"`,
  });

  await prisma.event.delete({ where: { id } });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  return { success: true };
}
