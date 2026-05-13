"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/action-helpers";
import { logAudit } from "@/lib/audit";

export async function createUser(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ success: true } | { error: string }> {
  try {
    await requireAdmin();
  } catch {
    return { error: "You don't have permission to create users." };
  }

  const { firstName, lastName, email, password } = data;

  if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return { error: "A user with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.toLowerCase().trim(),
      passwordHash,
      role: "USER",
      emailNotificationsEnabled: true,
    },
  });

  revalidatePath("/settings/users");
  return { success: true };
}

export async function deactivateUser(
  userId: string,
): Promise<{ success: true } | { error: string }> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { error: "You don't have permission to remove users." };
  }

  if (userId === session.user.id) {
    return { error: "You cannot remove your own account." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    return { error: "User not found." };
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });

  await logAudit({
    entityType: "USER",
    entityId: userId,
    actionType: "DELETED",
    performedById: session.user.id,
    summary: `Deactivated user ${user.email}`,
  });

  revalidatePath("/settings/users");
  return { success: true };
}
