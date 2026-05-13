"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { deleteManagedAvatar, isManagedAvatarUrl } from "@/lib/avatar-image-storage";

const PROFILE_NAME_MAX_LENGTH = 100;

function normalizeNamePart(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function updateProfileSettings({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const normalizedFirstName = normalizeNamePart(firstName);
  const normalizedLastName = normalizeNamePart(lastName);

  if (!normalizedFirstName && !normalizedLastName) {
    throw new Error("Enter at least one name.");
  }

  if (
    normalizedFirstName.length > PROFILE_NAME_MAX_LENGTH ||
    normalizedLastName.length > PROFILE_NAME_MAX_LENGTH
  ) {
    throw new Error(`Names must be ${PROFILE_NAME_MAX_LENGTH} characters or less.`);
  }

  const displayName = [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ");

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      firstName: normalizedFirstName || null,
      lastName: normalizedLastName || null,
      name: displayName,
    },
  });

  revalidatePath("/settings");
}

export async function updateEmail(email: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Email cannot be empty.");
  if (!normalized.includes("@")) throw new Error("Enter a valid email address.");
  if (normalized.length > 200) throw new Error("Email is too long.");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { email: normalized },
  });

  revalidatePath("/settings");
}

export async function updateAvatarUrl(url: string | null): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });

  if (existing?.avatarUrl && isManagedAvatarUrl(existing.avatarUrl)) {
    await deleteManagedAvatar(existing.avatarUrl);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: url },
  });

  revalidatePath("/settings");
}

export async function updateEmailNotificationPreference(enabled: boolean): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailNotificationsEnabled: enabled },
  });

  revalidatePath("/settings");
}
