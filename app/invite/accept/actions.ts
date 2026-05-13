"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const PASSWORD_MIN_LENGTH = 8;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeNamePart(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function getInviteStatus(token: string): Promise<
  | {
      status: "valid";
      email: string;
    }
  | {
      status: "missing" | "invalid" | "expired" | "used";
    }
> {
  if (!token) return { status: "missing" };

  const invite = await prisma.userInviteToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          email: true,
          isActive: true,
          passwordSetAt: true,
        },
      },
    },
  });

  if (!invite || !invite.user.isActive) return { status: "invalid" };
  if (invite.usedAt || invite.user.passwordSetAt) return { status: "used" };
  if (invite.expiresAt <= new Date()) return { status: "expired" };

  return { status: "valid", email: invite.user.email };
}

export async function acceptInvite(data: {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}): Promise<{ success: true; email: string } | { error: string }> {
  const firstName = normalizeNamePart(data.firstName);
  const lastName = normalizeNamePart(data.lastName);

  if (!firstName || !lastName) {
    return { error: "First and last name are required." };
  }
  if (data.password.length < PASSWORD_MIN_LENGTH) {
    return { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (data.password !== data.confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const tokenHash = hashToken(data.token);
  const invite = await prisma.userInviteToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      usedAt: true,
      userId: true,
      user: {
        select: {
          email: true,
          isActive: true,
          passwordSetAt: true,
        },
      },
    },
  });

  if (!invite || !invite.user.isActive) {
    return { error: "This invite link is invalid. Ask an admin to send a new invite." };
  }
  if (invite.usedAt || invite.user.passwordSetAt) {
    return { error: "This invite has already been used. Sign in with your password." };
  }
  if (invite.expiresAt <= new Date()) {
    return { error: "This invite has expired. Ask an admin to send a new invite." };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: invite.userId },
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        passwordHash,
        passwordSetAt: now,
      },
    }),
    prisma.userInviteToken.update({
      where: { id: invite.id },
      data: { usedAt: now },
    }),
    prisma.userInviteToken.updateMany({
      where: {
        userId: invite.userId,
        usedAt: null,
        id: { not: invite.id },
      },
      data: { usedAt: now },
    }),
  ]);

  return { success: true, email: invite.user.email };
}
