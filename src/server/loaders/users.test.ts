import { describe, expect, it } from "vitest";
import { addUser, countRoundTrips, testDb } from "@/test/db";
import { deactivateUser, inviteUser } from "../commands/users";
import { loadUsersScreen } from "./users";

describe("loadUsersScreen", () => {
  it("lists everyone by name, with their role and whether they're active, deactivated last", async () => {
    const db = await testDb();
    const admin = await addUser(db, { role: "admin", name: "Sam Rivera", email: "sam@museem.com" });
    const jo = await addUser(db, { name: "Jo Park", email: "jo@museem.com" });
    await addUser(db, { name: "ash Lee", email: "ash@museem.com" });
    await inviteUser(db, admin, { email: "new@museem.com" });
    await deactivateUser(db, admin, { userId: jo.userId });

    const { people } = await loadUsersScreen(db);

    expect(new Set(people.map((person) => person.avatarColour)).size).toBe(people.length);
    expect((await loadUsersScreen(db)).people.map((person) => person.avatarColour)).toEqual(people.map((person) => person.avatarColour));
    expect(people).toEqual([
      { id: expect.any(String), name: "ash Lee", email: "ash@museem.com", role: "user", active: true, avatarColour: expect.any(Number) },
      // Not signed in yet, so no name: listed by address.
      { id: expect.any(String), name: "", email: "new@museem.com", role: "user", active: true, avatarColour: expect.any(Number) },
      { id: admin.userId, name: "Sam Rivera", email: "sam@museem.com", role: "admin", active: true, avatarColour: expect.any(Number) },
      { id: jo.userId, name: "Jo Park", email: "jo@museem.com", role: "user", active: false, avatarColour: expect.any(Number) },
    ]);
  });

  it("stays within 2 sequential round trips", async () => {
    const db = await testDb();
    await addUser(db);

    expect(await countRoundTrips(db, () => loadUsersScreen(db))).toBeLessThanOrEqual(2);
  });
});
