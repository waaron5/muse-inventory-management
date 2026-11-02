import * as Sentry from "@sentry/nextjs";
import { randomUUID } from "node:crypto";
import { like } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signInCount, verification } from "@/db/schema";
import type { Db } from "@/db/types";
import { testAuth } from "@/test/auth";
import { addUser, testDb } from "@/test/db";
import { limitedSignIn } from "./sign-in";
import { createSignInLimits } from "./sign-in-limits";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

const TOO_MANY = { ok: false, message: "Too many tries. Wait a while and try again." };
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // Far from any window's edge, so a test's few steps stay in one window.
  vi.setSystemTime("2026-11-02T10:10:10Z");
  vi.mocked(Sentry.captureMessage).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

function setUp() {
  const { auth, outbox } = testAuth(db);
  const limits = createSignInLimits(db, "test-secret-at-least-32-characters-long");
  return { outbox, limits, signIn: limitedSignIn(auth, limits) };
}

const anAddress = () => `${randomUUID()}@museem.com`;
const anIp = () => randomUUID();
const advance = (ms: number) => vi.setSystemTime(Date.now() + ms);

describe("sending a code", () => {
  it("sends one a minute to an address", async () => {
    const { signIn, outbox } = setUp();
    const email = anAddress();
    await addUser(db, { email });

    expect(await signIn.send(email, null)).toEqual({ ok: true });
    expect(await signIn.send(email, null)).toEqual(TOO_MANY);

    expect(outbox.sent).toHaveLength(1);
    advance(MINUTE);
    expect(await signIn.send(email, null)).toEqual({ ok: true });
  });

  it("sends five an hour to an address", async () => {
    const { signIn, outbox } = setUp();
    const email = anAddress();
    await addUser(db, { email });

    for (let sent = 0; sent < 5; sent++) {
      expect(await signIn.send(email, null)).toEqual({ ok: true });
      advance(MINUTE);
    }
    expect(await signIn.send(email, null)).toEqual(TOO_MANY);
    expect(outbox.sent).toHaveLength(5);
  });

  it("treats an address the same however it's typed", async () => {
    const { signIn } = setUp();
    const email = anAddress();

    await signIn.send(email, null);

    expect(await signIn.send(` ${email.toUpperCase()} `, null)).toEqual(TOO_MANY);
  });

  it("refuses an uninvited address exactly as it refuses an invited one", async () => {
    const { signIn } = setUp();
    const invited = anAddress();
    await addUser(db, { email: invited });
    const uninvited = anAddress();

    await signIn.send(invited, null);
    await signIn.send(uninvited, null);

    expect(await signIn.send(uninvited, null)).toEqual(await signIn.send(invited, null));
  });

  it("sends twenty an hour from an IP, whatever the addresses", async () => {
    const { signIn } = setUp();
    const ip = anIp();

    for (let sent = 0; sent < 20; sent++) expect(await signIn.send(anAddress(), ip)).toEqual({ ok: true });

    expect(await signIn.send(anAddress(), ip)).toEqual(TOO_MANY);
    expect(await signIn.send(anAddress(), anIp())).toEqual({ ok: true });
  });

  it("lets only one of several requests at the same moment through", async () => {
    const { signIn, outbox } = setUp();
    const email = anAddress();
    await addUser(db, { email });

    const results = await Promise.all(Array.from({ length: 8 }, () => signIn.send(email, null)));

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(outbox.sent).toHaveLength(1);
  });
});

describe("checking a code", () => {
  const wrongCode = "000000";

  async function guessWrong(signIn: ReturnType<typeof setUp>["signIn"], email: string, times: number) {
    for (let guess = 0; guess < times; guess++) await signIn.verify(email, wrongCode, null);
  }

  it("refuses even the right code after ten wrong ones in an hour", async () => {
    const { signIn, outbox } = setUp();
    const email = anAddress();
    await addUser(db, { email });

    await guessWrong(signIn, email, 10);
    await signIn.send(email, null);

    expect(await signIn.verify(email, outbox.codeFor(email), null)).toEqual(TOO_MANY);
    advance(HOUR);
    await signIn.send(email, null);
    expect((await signIn.verify(email, outbox.codeFor(email), null)).ok).toBe(true);
  });

  it("doesn't start the count again when a new code is sent", async () => {
    const { signIn, outbox } = setUp();
    const email = anAddress();
    await addUser(db, { email });

    for (let round = 0; round < 3; round++) {
      await signIn.send(email, null);
      await guessWrong(signIn, email, 3);
      advance(MINUTE);
    }
    await signIn.send(email, null);
    await guessWrong(signIn, email, 1);
    advance(MINUTE);

    await signIn.send(email, null);
    expect(await signIn.verify(email, outbox.codeFor(email), null)).toEqual(TOO_MANY);
  });

  it("allows twenty wrong codes a day however they're spread", async () => {
    const { signIn } = setUp();
    const email = anAddress();

    await guessWrong(signIn, email, 10);
    advance(HOUR);
    await guessWrong(signIn, email, 10);
    advance(HOUR);
    expect(await signIn.verify(email, wrongCode, null)).toEqual(TOO_MANY);

    advance(DAY);
    expect(await signIn.verify(email, wrongCode, null)).not.toEqual(TOO_MANY);
  });

  it("allows thirty wrong codes an hour from an IP, whatever the addresses", async () => {
    const { signIn } = setUp();
    const ip = anIp();

    for (let guess = 0; guess < 30; guess++) {
      expect(await signIn.verify(anAddress(), wrongCode, ip)).not.toEqual(TOO_MANY);
    }

    expect(await signIn.verify(anAddress(), wrongCode, ip)).toEqual(TOO_MANY);
  });

  it("lets only the allowed number of guesses through at the same moment", async () => {
    const { signIn } = setUp();
    const email = anAddress();

    const results = await Promise.all(Array.from({ length: 16 }, () => signIn.verify(email, wrongCode, null)));

    expect(results.filter((result) => !result.ok && result.message === TOO_MANY.message)).toHaveLength(6);
  });

  it("doesn't count a right code against the person", async () => {
    const { signIn, outbox } = setUp();
    const email = anAddress();
    await addUser(db, { email });

    await guessWrong(signIn, email, 9);
    await signIn.send(email, null);
    expect((await signIn.verify(email, outbox.codeFor(email), null)).ok).toBe(true);

    expect(await signIn.verify(email, wrongCode, null)).not.toEqual(TOO_MANY);
    expect(await signIn.verify(email, wrongCode, null)).toEqual(TOO_MANY);
  });

  it("keeps waiting codes out of the database", async () => {
    const { signIn, outbox } = setUp();
    const email = anAddress();
    await addUser(db, { email });

    await signIn.send(email, null);

    const [stored] = await db.select().from(verification).where(like(verification.identifier, `%${email}%`));
    expect(stored.value).not.toContain(outbox.codeFor(email));
  });
});

describe("what the counts keep and report", () => {
  it("stores no address or IP", async () => {
    const { signIn } = setUp();
    const email = anAddress();
    const ip = anIp();

    await signIn.send(email, ip);

    const stored = JSON.stringify(await db.select().from(signInCount));
    expect(stored).not.toContain(email);
    expect(stored).not.toContain(ip);
  });

  it("reports an hourly limit once, without saying who", async () => {
    const { signIn } = setUp();
    const email = anAddress();

    for (let guess = 0; guess < 13; guess++) await signIn.verify(email, "000000", null);

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith("A sign-in limit was reached", {
      tags: { action: "guess", by: "email" },
    });
  });

  it("doesn't report someone pressing send twice in a minute", async () => {
    const { signIn } = setUp();
    const email = anAddress();

    await signIn.send(email, null);
    await signIn.send(email, null);

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("forgets windows that have ended, and only those", async () => {
    const { signIn, limits } = setUp();
    const email = anAddress();
    await signIn.send(email, null);

    await limits.forgetEnded();
    expect(await signIn.send(email, null)).toEqual(TOO_MANY);

    advance(2 * DAY);
    await limits.forgetEnded();
    expect(await db.select().from(signInCount)).toEqual([]);
  });
});
