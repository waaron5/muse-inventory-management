import { describe, expect, it, vi } from "vitest";
import { type BugMail, sendBugReport } from "./bug-report";

const reporter = { name: "Bea Ruiz", email: "bea@museem.com", role: "user" } as const;
const sentAt = { at: new Date("2026-10-24T17:05:00Z"), version: "4b4aabe" };
const typed = {
  what: "The Load button did nothing\non the BRL Cove event",
  page: "https://inventory.museem.com/events/7/load",
  device: "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)",
};

function outbox(sent = true) {
  const mails: BugMail[] = [];
  const send = vi.fn(async (mail: BugMail) => {
    mails.push(mail);
    return sent;
  });
  return { mails, send };
}

describe("Report a bug", () => {
  it("emails what happened with who, page, time, device and app version, replying to the reporter", async () => {
    const { mails, send } = outbox();

    expect(await sendBugReport(send, reporter, typed, sentAt)).toEqual({ sent: true });

    expect(mails).toHaveLength(1);
    const [mail] = mails;
    expect(mail.replyTo).toBe("bea@museem.com");
    expect(mail.subject).toBe("Bug report from Bea Ruiz: The Load button did nothing");
    expect(mail.text).toBe(
      [
        "The Load button did nothing",
        "on the BRL Cove event",
        "",
        "—",
        "From: Bea Ruiz <bea@museem.com>, User",
        "Page: https://inventory.museem.com/events/7/load",
        "Time: Oct 24, 2026, 11:05 AM",
        "Device: Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)",
        "App version: 4b4aabe",
        "Last error: none",
      ].join("\n"),
    );
    expect(mail.attachments).toEqual([]);
  });

  it("attaches the screenshot", async () => {
    const { mails, send } = outbox();
    const screenshot = new File([new Uint8Array([0xff, 0xd8, 0xff])], "IMG_0042.jpg", { type: "image/jpeg" });

    await sendBugReport(send, reporter, { ...typed, screenshot }, sentAt);

    expect(mails[0].attachments).toEqual([{ filename: "IMG_0042.jpg", content: Buffer.from([0xff, 0xd8, 0xff]) }]);
  });

  it("names the last error and its tracker ID", async () => {
    const { mails, send } = outbox();

    const lastError = { message: "Something went wrong.", trackerId: "3141592653" };
    await sendBugReport(send, reporter, { ...typed, lastError }, sentAt);

    expect(mails[0].text).toContain("Last error: Something went wrong. (tracker ID 3141592653)");
  });

  it("needs to be told what happened", async () => {
    const { send } = outbox();

    expect(await sendBugReport(send, reporter, { ...typed, what: "  " }, sentAt)).toEqual({ error: "Say what happened." });
    expect(send).not.toHaveBeenCalled();
  });

  it("takes one image under 10 MB as the screenshot", async () => {
    const { send } = outbox();
    const big = new File([new Uint8Array(10 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" });
    const notImage = new File(["%PDF"], "notes.pdf", { type: "application/pdf" });

    for (const screenshot of [big, notImage]) {
      expect(await sendBugReport(send, reporter, { ...typed, screenshot }, sentAt)).toEqual({
        error: "Choose an image under 10 MB.",
      });
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("says it couldn't send when the email doesn't go", async () => {
    const refused = outbox(false);
    expect(await sendBugReport(refused.send, reporter, typed, sentAt)).toEqual({ error: "Couldn't send. Try again." });

    const thrown = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    expect(await sendBugReport(thrown, reporter, typed, sentAt)).toEqual({ error: "Couldn't send. Try again." });
  });
});
