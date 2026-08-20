"use server";

import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/action-helpers";
import { logAudit } from "@/lib/audit";
import { buildUserInviteEmail, sendEmail } from "@/lib/email";
import type { UserRole } from "@prisma/client";

const INVITE_EXPIRATION_HOURS = 48;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getRoleLabel(role: UserRole) {
  return role === "ADMIN" ? "Administrator" : "Team Member";
}

function createInviteToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

async function createInviteForUser(userId: string) {
  await prisma.userInviteToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { token, tokenHash } = createInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRATION_HOURS * 60 * 60 * 1000);

  await prisma.userInviteToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return `${APP_URL}/invite/accept?token=${encodeURIComponent(token)}`;
}

type InviteUserResult = { success: true; message?: string } | { error: string };

export async function inviteUser(data: {
  email: string;
  role: UserRole;
}): Promise<InviteUserResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { error: "You don't have permission to invite users." };
  }

  const email = normalizeEmail(data.email);
  const role = data.role;

  if (!email) {
    return { error: "Email is required." };
  }
  if (!email.includes("@")) {
    return { error: "Enter a valid email address." };
  }
  if (role !== "ADMIN" && role !== "USER") {
    return { error: "Select a valid role." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser?.passwordSetAt && existingUser.isActive) {
    return { error: "A user with that email already has access." };
  }

  if (existingUser?.passwordSetAt && !existingUser.isActive) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role,
        isActive: true,
      },
    });

    await logAudit({
      entityType: "USER",
      entityId: existingUser.id,
      actionType: "ACTIVATED",
      performedById: session.user.id,
      summary: `Reactivated ${email} as ${getRoleLabel(role)}`,
    });

    revalidatePath("/settings");
    revalidatePath("/settings/users");
    return {
      success: true,
      message: `${email} has been reactivated as ${getRoleLabel(role)}. They can log in with their existing password.`,
    };
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 12);
  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        firstName: null,
        lastName: null,
        name: email,
        email,
        passwordHash,
        role,
        emailNotificationsEnabled: true,
        isActive: true,
        passwordSetAt: null,
      },
    }));

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role,
        isActive: true,
      },
    });
  }

  const inviteUrl = await createInviteForUser(user.id);
  const { subject, html } = buildUserInviteEmail({
    inviteUrl,
    roleLabel: getRoleLabel(role),
  });
  const sent = await sendEmail({ to: email, subject, html });
  if (!sent) {
    return { error: "The invite was created, but email could not be sent." };
  }

  await logAudit({
    entityType: "USER",
    entityId: user.id,
    actionType: existingUser ? "UPDATED" : "CREATED",
    performedById: session.user.id,
    summary: `${existingUser ? "Resent invite to" : "Invited"} ${email} as ${getRoleLabel(role)}`,
  });

  revalidatePath("/settings");
  revalidatePath("/settings/users");
  return { success: true };
}

export async function resendUserInvite(
  userId: string,
): Promise<{ success: true } | { error: string }> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { error: "You don't have permission to resend invites." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      passwordSetAt: true,
    },
  });

  if (!user || !user.isActive) {
    return { error: "User not found." };
  }
  if (user.passwordSetAt) {
    return { error: "This user has already accepted their invite." };
  }

  const inviteUrl = await createInviteForUser(user.id);
  const { subject, html } = buildUserInviteEmail({
    inviteUrl,
    roleLabel: getRoleLabel(user.role),
  });
  const sent = await sendEmail({ to: user.email, subject, html });
  if (!sent) {
    return { error: "The invite could not be emailed. Check email configuration." };
  }

  await logAudit({
    entityType: "USER",
    entityId: user.id,
    actionType: "UPDATED",
    performedById: session.user.id,
    summary: `Resent invite to ${user.email}`,
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
