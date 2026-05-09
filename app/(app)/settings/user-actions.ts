"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/action-helpers";

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
