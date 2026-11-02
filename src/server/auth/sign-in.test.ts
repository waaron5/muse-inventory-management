import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { user } from "@/db/schema";
import type { Db } from "@/db/types";
import { addUser, testDb } from "@/test/db";
import { testAuth } from "@/test/auth";
import { readSession } from "./session";
import { sendCode, signIn } from "./sign-in";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("sign in by emailed code", () => {
  it("lets an invited person in with the code emailed to them", async () => {
    const { auth, outbox } = testAuth(db);
    await addUser(db, { email: "sam@museem.com" });

    await sendCode(auth, "sam@museem.com");
    const result = await signIn(auth, "sam@museem.com", outbox.codeFor("sam@museem.com"));

    expect(result).toMatchObject({ ok: true, needsName: false });
    const session = await readSession(auth, result.ok ? result.cookie : new Headers());
    expect(session?.user.email).toBe("sam@museem.com");
  });

  it("matches the address ignoring case and stray spaces", async () => {
    const { auth, outbox } = testAuth(db);
    await addUser(db, { email: "jo@museem.com" });

    await sendCode(auth, " Jo@MuseEM.com ");
    const result = await signIn(auth, "JO@museem.com ", outbox.codeFor("jo@museem.com"));

    expect(result.ok).toBe(true);
  });

  it("turns away an uninvited address exactly as it turns away a wrong code", async () => {
    const { auth, outbox } = testAuth(db);
    await addUser(db, { email: "lee@museem.com" });
    await sendCode(auth, "lee@museem.com");

    await expect(sendCode(auth, "stranger@example.com")).resolves.toBeUndefined();

    expect(outbox.sent.map((mail) => mail.to)).toEqual(["lee@museem.com"]);
    const wrongCode = await signIn(auth, "lee@museem.com", "000000");
    const uninvited = await signIn(auth, "stranger@example.com", "000000");
    expect(wrongCode).toEqual({ ok: false, message: CODE_DID_NOT_WORK });
    expect(uninvited).toEqual(wrongCode);
  });

  it("emails a deactivated person no code, and refuses one sent before they were deactivated", async () => {
    const { auth, outbox } = testAuth(db);
    const { userId } = await addUser(db, { email: "kit@museem.com" });
    await sendCode(auth, "kit@museem.com");
    const earlierCode = outbox.codeFor("kit@museem.com");
    await db.update(user).set({ banned: true }).where(eq(user.id, userId));

    await sendCode(auth, "kit@museem.com");

    expect(outbox.sent).toHaveLength(1);
    expect(await signIn(auth, "kit@museem.com", earlierCode)).toEqual({
      ok: false,
      message: CODE_DID_NOT_WORK,
    });
  });

  describe("a code", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("works for 5 minutes and no longer", async () => {
      const { auth, outbox } = testAuth(db);
      await addUser(db, { email: "ash@museem.com" });
      await addUser(db, { email: "bo@museem.com" });
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-20T09:00:00Z") });
      await sendCode(auth, "ash@museem.com");
      await sendCode(auth, "bo@museem.com");

      vi.setSystemTime(new Date("2026-10-20T09:04:50Z"));
      const inTime = await signIn(auth, "ash@museem.com", outbox.codeFor("ash@museem.com"));
      vi.setSystemTime(new Date("2026-10-20T09:05:10Z"));
      const tooLate = await signIn(auth, "bo@museem.com", outbox.codeFor("bo@museem.com"));

      expect(inTime.ok).toBe(true);
      expect(tooLate).toEqual({ ok: false, message: CODE_DID_NOT_WORK });
    });

    it("is refused on the fourth attempt, even when it's right", async () => {
      const { auth, outbox } = testAuth(db);
      await addUser(db, { email: "cy@museem.com" });
      await sendCode(auth, "cy@museem.com");
      const code = outbox.codeFor("cy@museem.com");
      const wrong = code === "111111" ? "222222" : "111111";

      for (let attempt = 1; attempt <= 3; attempt++) {
        await signIn(auth, "cy@museem.com", wrong);
      }

      expect(await signIn(auth, "cy@museem.com", code)).toEqual({
        ok: false,
        message: CODE_DID_NOT_WORK,
      });
    });

    it("still works after two wrong attempts", async () => {
      const { auth, outbox } = testAuth(db);
      await addUser(db, { email: "di@museem.com" });
      await sendCode(auth, "di@museem.com");
      const code = outbox.codeFor("di@museem.com");
      const wrong = code === "111111" ? "222222" : "111111";

      await signIn(auth, "di@museem.com", wrong);
      await signIn(auth, "di@museem.com", wrong);

      expect((await signIn(auth, "di@museem.com", code)).ok).toBe(true);
    });
  });
});

const CODE_DID_NOT_WORK = "That code didn't work. Check your latest email, or send a new code.";
