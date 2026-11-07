import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/types";
import { addAiConnection, addUser, testDb } from "@/test/db";
import type { BugMail, SendBugMail } from "../bug-report";
import type { AiConnection } from "./connection";
import { mcpServer } from "./mcp-server";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));

const APP = "https://inventory.museem.com";

describe("reporting a bug through an AI Connection", () => {
  let db: Db;
  let connection: AiConnection;

  beforeAll(async () => {
    db = await testDb();
    const bea = await addUser(db, { role: "user", name: "Bea Ruiz", email: "bea@museem.com" });
    const { aiTokenId, clientId } = await addAiConnection(db, bea.userId, { name: "Claude" });
    connection = { userId: bea.userId, name: "Bea Ruiz", email: "bea@museem.com", role: "user", clientId, appName: "Claude", aiTokenId };
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-11-06T10:10:10Z");
    vi.mocked(Sentry.captureException).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function reportBug(send: SendBugMail, what: string) {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await mcpServer({ db, appURL: APP, connection, sendInvite: async () => "emailed", sendBugMail: send }).connect(serverSide);
    const ai = new Client({ name: connection.appName, version: "1.0.0" });
    await ai.connect(clientSide);
    const result = await ai.callTool({ name: "reportBug", arguments: { what } });
    await ai.close();
    const text = (result.content as { text: string }[])[0].text;
    return result.isError ? { refused: text } : JSON.parse(text);
  }

  it("emails the report as Report a bug does, saying which app it came through in place of page and device", async () => {
    const mails: BugMail[] = [];

    const answer = await reportBug(
      async (mail) => (mails.push(mail), true),
      "Searching for chairs times out\nThey disconnected and connected again; same thing",
    );

    expect(answer).toEqual({ sent: "Sent to Muse Inventory's maintainer, who replies to bea@museem.com." });
    expect(mails).toEqual([
      {
        subject: "Bug report from Bea Ruiz: Searching for chairs times out",
        text: [
          "Searching for chairs times out",
          "They disconnected and connected again; same thing",
          "",
          "—",
          "From: Bea Ruiz <bea@museem.com>, User",
          "Reported via Claude",
          "Time: Nov 6, 2026, 3:10 AM",
          "App version: local",
        ].join("\n"),
        replyTo: "bea@museem.com",
        attachments: [],
      },
    ]);
  });

  it("says it couldn't send, and tells Sentry, when the email doesn't go", async () => {
    const down = new Error("ECONNRESET");

    const answer = await reportBug(async () => {
      throw down;
    }, "Searching for chairs times out");

    expect(answer).toEqual({ refused: "Couldn't send. Try again." });
    expect(Sentry.captureException).toHaveBeenCalledWith(down);
  });

  it("needs to be told what happened", async () => {
    const send = vi.fn(async () => true);

    expect(await reportBug(send, "  ")).toEqual({ refused: "Say what happened." });
    expect(send).not.toHaveBeenCalled();
  });
});
