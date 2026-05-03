"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateEmailNotificationPreference(
  enabled: boolean
): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailNotificationsEnabled: enabled },
  });

  revalidatePath("/settings");
}
