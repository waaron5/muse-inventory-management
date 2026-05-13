"use server";

import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { deleteManagedInventoryImage } from "@/lib/inventory-image-storage";
import { requireStorageLocationName } from "@/lib/storage-locations";
import { revalidatePath } from "next/cache";
import { InventoryStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/action-helpers";

export async function createInventoryItem(formData: {
  title: string;
  description?: string;
  imageUrl?: string | null;
  quantity: number;
  currentLocation: string;
  notes?: string;
}) {
  const session = await requireAdmin();
  const currentLocation = await requireStorageLocationName(formData.currentLocation);

  const item = await prisma.inventoryItem.create({
    data: {
      ...formData,
      currentLocation,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "INVENTORY_ITEM",
    entityId: item.id,
    actionType: "CREATED",
    performedById: session.user.id,
    summary: `Created inventory item "${item.title}"`,
  });

  revalidatePath("/inventory");
  return { success: true, id: item.id };
}

export async function updateInventoryItem(
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
  const existingItem = await prisma.inventoryItem.findUnique({
    where: { id },
    select: { imageUrl: true },
  });

  if (!existingItem) {
    throw new Error("Item not found");
  }

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      ...formData,
      currentLocation,
      updatedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "INVENTORY_ITEM",
    entityId: id,
    actionType: "UPDATED",
    performedById: session.user.id,
    summary: `Updated inventory item "${item.title}"`,
    metadata: { ...formData, currentLocation } as Record<string, unknown>,
  });

  if (existingItem.imageUrl && existingItem.imageUrl !== item.imageUrl) {
    try {
      await deleteManagedInventoryImage(existingItem.imageUrl);
    } catch (error) {
      console.error("Failed to remove replaced inventory image", error);
    }
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  return { success: true };
}

export async function adjustInventoryQuantity(id: string, newQuantity: number, reason?: string) {
  const session = await requireAdmin();

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      quantity: newQuantity,
      updatedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "INVENTORY_ITEM",
    entityId: id,
    actionType: "QUANTITY_ADJUSTED",
    performedById: session.user.id,
    summary: `Adjusted quantity of "${item.title}" to ${newQuantity}${reason ? `: ${reason}` : ""}`,
    metadata: { newQuantity, reason },
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  return { success: true };
}

export async function retireInventoryItem(id: string) {
  const session = await requireAdmin();

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      status: InventoryStatus.RETIRED,
      updatedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "INVENTORY_ITEM",
    entityId: id,
    actionType: "RETIRED",
    performedById: session.user.id,
    summary: `Retired inventory item "${item.title}"`,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  return { success: true };
}

export async function activateInventoryItem(id: string) {
  const session = await requireAdmin();

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      status: InventoryStatus.ACTIVE,
      updatedById: session.user.id,
    },
  });

  await logAudit({
    entityType: "INVENTORY_ITEM",
    entityId: id,
    actionType: "ACTIVATED",
    performedById: session.user.id,
    summary: `Re-activated inventory item "${item.title}"`,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  return { success: true };
}
