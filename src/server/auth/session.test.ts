import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { user } from "@/db/schema";
import type { Db } from "@/db/types";
import { createLocation } from "@/server/commands/create-location";
import { testAuth } from "@/test/auth";
import { addUser, testDb } from "@/test/db";
import { readSession } from "./session";
import { sendCode, signIn } from "./sign-in";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

afterEach(() => {
  vi.useRealTimers();
});

async function signedInCookie(auth: ReturnType<typeof testAuth>["auth"], outbox: ReturnType<typeof testAuth>["outbox"], email: string) {
  await sendCode(auth, email);
  const result = await signIn(auth, email, outbox.codeFor(email));
  if (!result.ok) throw new Error(result.message);
  return result.cookie;
}

describe("a deactivated person", () => {
  it("can change nothing from that moment, though screens may trust their cookie for up to 5 minutes", async () => {
    const { auth, outbox } = testAuth(db);
    const { userId } = await addUser(db, { email: "pat@museem.com" });
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-20T09:00:00Z") });
    const cookie = await signedInCookie(auth, outbox, "pat@museem.com");
    const session = await readSession(auth, cookie);

    await db.update(user).set({ banned: true }).where(eq(user.id, userId));

    await expect(createLocation(db, session!.actor, { name: "Garage" })).rejects.toMatchObject({
      code: "not-signed-in",
    });
    vi.setSystemTime(new Date("2026-10-20T09:04:50Z"));
    expect((await readSession(auth, cookie))?.user.email).toBe("pat@museem.com");
    vi.setSystemTime(new Date("2026-10-20T09:05:10Z"));
    expect(await readSession(auth, cookie)).toBeNull();
  });
});
