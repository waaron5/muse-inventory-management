import { asc, eq, sql } from "drizzle-orm";
import { user } from "@/db/schema";
import { defineLoader } from "./define";

const chosenColour = sql<number>`coalesce(${user.avatarColourChoice}, ${user.avatarColour})`;

// One round trip: everyone, active first, by the name they go by. Someone
// invited who hasn't signed in yet has no name, so goes by their address.
export const loadUsersScreen = defineLoader("users", async (db) => {
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned, avatarColour: chosenColour })
    .from(user)
    .orderBy(asc(user.banned), asc(sql`lower(coalesce(nullif(${user.name}, ''), ${user.email}))`));
  return { people: rows.map(({ banned, ...person }) => ({ ...person, active: !banned })) };
});

/** Read preferences fresh so a cached sign-in never restores an old colour. */
export const loadAvatarColour = defineLoader("avatarColour", async (db, id: string) => {
  const [person] = await db.select({ colour: chosenColour }).from(user).where(eq(user.id, id));
  return person?.colour;
});

export const loadProfileColour = defineLoader("profileColour", async (db, id: string) => {
  const [profile] = await db.select({ automaticColour: user.avatarColour, choice: user.avatarColourChoice })
    .from(user).where(eq(user.id, id));
  return profile;
});
