import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { readSession } from "@/server/auth/session";
import { sendCode, signIn } from "@/server/auth/sign-in";
import { testAuth } from "@/test/auth";
import { addSession, addUser, testDb } from "@/test/db";
import { createLocation } from "./create-location";
import { changeRole, deactivateUser, deleteUser, inviteUser, reactivateUser } from "./users";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("inviteUser", () => {
  it("always invites a User, even if an extra input requests Admin", async () => {
    const admin = await addUser(db, { role: "admin" });
    const { auth, outbox } = testAuth(db);

    const input = { email: " Pat@MuseEM.com ", role: "admin" };
    await inviteUser(db, admin, input);

    await sendCode(auth, "pat@museem.com");
    const result = await signIn(auth, "pat@museem.com", outbox.codeFor("pat@museem.com"));
    expect(result).toMatchObject({ ok: true, needsName: true });
    const session = await readSession(auth, result.ok ? result.cookie : new Headers());
    expect(session?.user).toMatchObject({ email: "pat@museem.com", role: "user" });
  });

  it("refuses addresses outside museem.com", async () => {
    const admin = await addUser(db, { role: "admin" });

    await expect(inviteUser(db, admin, { email: "freelancer@gmail.com" })).rejects.toMatchObject({
      code: "invalid",
      message: "Use an email ending in @museem.com.",
    });
  });

  it("refuses an address that already has access, whatever its case", async () => {
    const admin = await addUser(db, { role: "admin" });
    await inviteUser(db, admin, { email: "quinn@museem.com" });

    await expect(inviteUser(db, admin, { email: "Quinn@museem.com" })).rejects.toMatchObject({
      code: "invalid",
      message: "quinn@museem.com already has access.",
    });
  });

  it("points a deactivated address to Reactivate", async () => {
    const admin = await addUser(db, { role: "admin" });
    await addUser(db, { email: "rae@museem.com", banned: true });

    await expect(inviteUser(db, admin, { email: "rae@museem.com" })).rejects.toMatchObject({
      code: "invalid",
      message: "rae@museem.com is deactivated. Reactivate them instead.",
    });
  });

  it("refuses something that isn't an email address", async () => {
    const admin = await addUser(db, { role: "admin" });

    await expect(inviteUser(db, admin, { email: "not an address" })).rejects.toMatchObject({
      code: "invalid",
      message: "Enter an email address.",
    });
  });

  it("is an Admin's to do", async () => {
    const user = await addUser(db);

    await expect(inviteUser(db, user, { email: "sly@museem.com" })).rejects.toMatchObject({
      code: "not-allowed",
    });
  });
});

describe("deactivateUser", () => {
  it("signs them out of every device at once, and keeps them from signing in", async () => {
    const admin = await addUser(db, { role: "admin" });
    const { auth, outbox } = testAuth(db);
    const phone = await addUser(db, { email: "tam@museem.com" });
    const laptop = await addSession(db, phone.userId);

    await deactivateUser(db, admin, { userId: phone.userId });

    for (const device of [phone, laptop]) {
      await expect(createLocation(db, device, { name: "Garage" })).rejects.toMatchObject({ code: "not-signed-in" });
    }
    await sendCode(auth, "tam@museem.com");
    expect(outbox.sent.filter((mail) => mail.to === "tam@museem.com")).toEqual([]);
  });

  it("refuses a code they were sent just before", async () => {
    const admin = await addUser(db, { role: "admin" });
    const { auth, outbox } = testAuth(db);
    const { userId } = await addUser(db, { email: "val@museem.com" });
    await sendCode(auth, "val@museem.com");

    await deactivateUser(db, admin, { userId });

    expect((await signIn(auth, "val@museem.com", outbox.codeFor("val@museem.com"))).ok).toBe(false);
  });

  it("can be undone: a reactivated person signs in again", async () => {
    const admin = await addUser(db, { role: "admin" });
    const { auth, outbox } = testAuth(db);
    const { userId } = await addUser(db, { email: "uma@museem.com" });
    await deactivateUser(db, admin, { userId });

    await reactivateUser(db, admin, { userId });

    await sendCode(auth, "uma@museem.com");
    expect((await signIn(auth, "uma@museem.com", outbox.codeFor("uma@museem.com"))).ok).toBe(true);
  });

  it("is an Admin's to do", async () => {
    const user = await addUser(db);
    const other = await addUser(db);

    await expect(deactivateUser(db, user, { userId: other.userId })).rejects.toMatchObject({ code: "not-allowed" });
    await expect(reactivateUser(db, user, { userId: other.userId })).rejects.toMatchObject({ code: "not-allowed" });
  });

  it("refuses someone who no longer exists", async () => {
    const admin = await addUser(db, { role: "admin" });

    await expect(deactivateUser(db, admin, { userId: crypto.randomUUID() })).rejects.toMatchObject({
      code: "invalid",
      message: "That person no longer exists.",
    });
  });
});

describe("changeRole", () => {
  it("makes a User an Admin, and back", async () => {
    const admin = await addUser(db, { role: "admin" });
    const vic = await addUser(db);

    await changeRole(db, admin, { userId: vic.userId, role: "admin" });
    await expect(inviteUser(db, vic, { email: "wyn@museem.com" })).resolves.toBeDefined();

    await changeRole(db, admin, { userId: vic.userId, role: "user" });
    await expect(inviteUser(db, vic, { email: "xan@museem.com" })).rejects.toMatchObject({
      code: "not-allowed",
    });
  });

  it("is an Admin's to do", async () => {
    const user = await addUser(db);

    await expect(changeRole(db, user, { userId: user.userId, role: "admin" })).rejects.toMatchObject({
      code: "not-allowed",
    });
  });
});

describe("there is always at least one Admin", () => {
  it("refuses changing your own role or access even when another Admin remains", async () => {
    const lonely = await testDb();
    const admin = await addUser(lonely, { role: "admin" });
    await addUser(lonely, { role: "admin" });

    await expect(changeRole(lonely, admin, { userId: admin.userId, role: "user" })).rejects.toMatchObject({
      code: "invalid",
      message: "You can only change another person's role or access.",
    });
    await expect(deactivateUser(lonely, admin, { userId: admin.userId })).rejects.toMatchObject({
      code: "invalid",
      message: "You can only change another person's role or access.",
    });
    await expect(deleteUser(lonely, admin, { userId: admin.userId })).rejects.toMatchObject({
      code: "invalid",
      message: "You can only change another person's role or access.",
    });
  });

  it("lets an Admin change another person's role, revoking their admin permissions", async () => {
    const two = await testDb();
    const first = await addUser(two, { role: "admin" });
    const second = await addUser(two, { role: "admin" });

    await changeRole(two, first, { userId: second.userId, role: "user" });

    await expect(deactivateUser(two, second, { userId: first.userId })).rejects.toMatchObject({
      code: "not-allowed",
    });
  });

  it("holds when two Admins change each other's access at the same moment", async () => {
    const two = await testDb();
    const first = await addUser(two, { role: "admin" });
    const second = await addUser(two, { role: "admin" });

    const results = await Promise.allSettled([
      changeRole(two, first, { userId: second.userId, role: "user" }),
      deactivateUser(two, second, { userId: first.userId }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
  });
});
