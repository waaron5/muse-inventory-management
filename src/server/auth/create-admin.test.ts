import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { user } from "@/db/schema";
import type { Db } from "@/db/types";
import { deleteUser, inviteUser } from "@/server/commands/users";
import { testAuth } from "@/test/auth";
import { addUser, testDb } from "@/test/db";
import { createAdmin } from "../../../scripts/create-admin";
import { readSession } from "./session";
import { sendCode, signIn } from "./sign-in";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

function runScript(email: string) {
  const client = (db as unknown as { $client: PGlite }).$client;
  return createAdmin((sql, params) => client.query(sql, params), email);
}

async function rowFor(email: string) {
  const [found] = await db.select().from(user).where(eq(user.email, email));
  return found;
}

describe("the create-admin script", () => {
  it("makes an Admin who can sign in by code, however the address was typed", async () => {
    const { auth, outbox } = testAuth(db);

    const result = await runScript(" Maintainer@Example.com ");

    expect(result.ok).toBe(true);
    await sendCode(auth, "maintainer@example.com");
    const signedIn = await signIn(auth, "maintainer@example.com", outbox.codeFor("maintainer@example.com"));
    expect(signedIn).toMatchObject({ ok: true, needsName: true });
    const session = await readSession(auth, signedIn.ok ? signedIn.cookie : new Headers());
    expect(session?.user).toMatchObject({ email: "maintainer@example.com", role: "admin", name: "" });
  });

  it("leaves an existing account as it is", async () => {
    await addUser(db, { email: "existing@example.com", role: "user" });

    const result = await runScript("existing@example.com");

    expect(result).toEqual({ ok: false, message: "existing@example.com already has an account. Nothing changed." });
    expect((await rowFor("existing@example.com")).role).toBe("user");
  });

  it("refuses something that isn't an address", async () => {
    expect((await runScript("not an address")).ok).toBe(false);
  });
});

describe("once the script's Admin is deleted", () => {
  it("stays deleted when the address asks for a code, and comes back only as an invited User", async () => {
    const { auth, outbox } = testAuth(db);
    const email = "former@museem.com";
    await runScript(email);
    const { id } = await rowFor(email);
    const otherAdmin = await addUser(db, { role: "admin" });
    await deleteUser(db, otherAdmin, { userId: id });

    await sendCode(auth, email);

    expect(await rowFor(email)).toBeUndefined();
    expect(outbox.sent).toEqual([]);

    await inviteUser(db, otherAdmin, { email });
    expect((await rowFor(email)).role).toBe("user");
  });
});
