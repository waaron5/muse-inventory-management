import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { session, user } from "@/db/schema";
import type { Tx } from "@/db/types";
import { CommandError } from "../errors";
import { ref, said } from "./activity";
import { defineCommand } from "./define";
import { remember } from "../deleted-records";

// Admins manage who has access (Login and user accounts). An invite is the
// person's row, so their first sign-in by code simply finds it; deactivating
// is Better Auth's ban, and ends every session they have at once (ADR 0008).

const role = z.enum(["admin", "user"], "Choose Admin or User.");
const someone = { userId: z.string().min(1, "That person no longer exists.") };

export const inviteUser = defineCommand({
  name: "inviteUser",
  input: z.object({
    // Stored lower-case, as sign-in matches it.
    email: z.string().trim().toLowerCase().pipe(z.email("Enter an email address."))
      .refine((email) => email.endsWith("@museem.com"), "Use an email ending in @museem.com."),
  }),
  allow: ["admin"],
  run: async (tx, _actor, input, record) => {
    const [invited] = await tx
      .insert(user)
      .values({ id: randomUUID(), name: "", email: input.email, role: "user" })
      .onConflictDoNothing({ target: user.email })
      .returning({ id: user.id, email: user.email });
    if (invited) {
      await record("people", said`invited ${ref.user(invited.id, invited.email)}`);
      return invited;
    }
    const [existing] = await tx.select({ banned: user.banned }).from(user).where(eq(user.email, input.email));
    throw new CommandError(
      "invalid",
      existing?.banned
        ? `${input.email} is deactivated. Reactivate them instead.`
        : `${input.email} already has access.`,
    );
  },
});

export const changeRole = defineCommand({
  name: "changeRole",
  input: z.object({ ...someone, role }),
  allow: ["admin"],
  run: async (tx, actor, input, record) => {
    refuseSelf(actor.userId, input.userId);
    if (input.role === "user") await keepAnAdminBesides(tx, input.userId);
    const person = await lockPerson(tx, input.userId);
    await tx.update(user).set({ role: input.role, updatedAt: new Date() }).where(eq(user.id, input.userId));
    await record("people", person.role === input.role ? null : said`made ${person.ref} ${input.role === "admin" ? "an Admin" : "a User"}`);
  },
});

export const deactivateUser = defineCommand({
  name: "deactivateUser",
  input: z.object(someone),
  allow: ["admin"],
  run: async (tx, actor, input, record) => {
    refuseSelf(actor.userId, input.userId);
    await keepAnAdminBesides(tx, input.userId);
    const person = await lockPerson(tx, input.userId);
    await tx.update(user).set({ banned: true, updatedAt: new Date() }).where(eq(user.id, input.userId));
    await tx.delete(session).where(eq(session.userId, input.userId));
    await record("people", said`deactivated ${person.ref}`);
  },
});

// Their name stays on everything they did, so they come back as they were.
export const reactivateUser = defineCommand({
  name: "reactivateUser",
  input: z.object(someone),
  allow: ["admin"],
  run: async (tx, _actor, input, record) => {
    const person = await lockPerson(tx, input.userId);
    await tx.update(user).set({ banned: false, updatedAt: new Date() }).where(eq(user.id, input.userId));
    await record("people", said`reactivated ${person.ref}`);
  },
});

export const deleteUser = defineCommand({
  name: "deleteUser",
  input: z.object(someone),
  allow: ["admin"],
  run: async (tx, actor, { userId }, record) => {
    refuseSelf(actor.userId, userId);
    await keepAnAdminBesides(tx, userId);
    const person = await lockPerson(tx, userId);
    await remember(tx, { id: userId, kind: "user", name: person.ref.name });
    await tx.delete(user).where(eq(user.id, userId));
    await record("people", said`deleted ${person.ref}`);
  },
});

/** Access and role management always target somebody else. */
function refuseSelf(actorId: string, targetId: string) {
  if (actorId === targetId) {
    throw new CommandError("invalid", "You can only change another person's role or access.");
  }
}

/** The person, locked until this saves, by the name they go by. */
async function lockPerson(tx: Tx, userId: string) {
  const [found] = await tx
    .select({ name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .for("update");
  if (!found) throw new CommandError("invalid", "That person no longer exists.");
  return { role: found.role, ref: ref.user(userId, found.name || found.email) };
}

/**
 * There is always at least one Admin: refuses unless an active Admin other
 * than this person remains. Every active Admin is locked, in one order, before
 * they're counted, so two Admins stepping down at the same moment can't both
 * see the other still there.
 */
async function keepAnAdminBesides(tx: Tx, userId: string) {
  const admins = await tx
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, "admin"), eq(user.banned, false)))
    .orderBy(asc(user.id))
    .for("update");
  if (!admins.some((admin) => admin.id !== userId)) {
    throw new CommandError("invalid", "There must always be at least one Admin. Make someone else an Admin first.");
  }
}
