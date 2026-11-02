import * as Sentry from "@sentry/nextjs";
import { couldNotSend, screenshotLimit, screenshotRefused } from "@/lib/bug-report";
import { formatMoment } from "@/lib/format";
import type { PageError } from "@/lib/last-error";
import type { Role } from "./commands/define";

/** A bug report as it's emailed to the maintainer: reply goes to the reporter. */
export type BugMail = {
  subject: string;
  text: string;
  replyTo: string;
  attachments: { filename: string; content: Buffer }[];
};
export type SendBugMail = (mail: BugMail) => Promise<boolean>;

export type Reporter = { name: string; email: string; role: Role };

/** What the form sends: what happened, the optional screenshot, and where it was. */
export type BugReportInput = {
  what: string;
  page: string;
  device: string;
  lastError?: PageError;
  screenshot?: File | null;
};

export type BugReportState = { error?: string; sent?: boolean };

/**
 * Emails a bug report to the maintainer with its context attached: who, page,
 * time, device, app version, and the last error with its tracker ID. Nothing
 * is stored; a failure to send is reported to Sentry and the form keeps it.
 */
export async function sendBugReport(
  send: SendBugMail,
  reporter: Reporter,
  input: BugReportInput,
  { at, version }: { at: Date; version: string },
): Promise<BugReportState> {
  const what = input.what.trim();
  if (!what) return { error: "Say what happened." };
  const screenshot = input.screenshot?.size ? input.screenshot : null;
  if (screenshot && (!screenshot.type.startsWith("image/") || screenshot.size >= screenshotLimit)) {
    return { error: screenshotRefused };
  }

  const { lastError } = input;
  const lastErrorLine = lastError
    ? `${lastError.message}${lastError.trackerId ? ` (tracker ID ${lastError.trackerId})` : ""}`
    : "none";
  const mail: BugMail = {
    subject: `Bug report from ${reporter.name}: ${what.split("\n")[0].slice(0, 80)}`,
    text: [
      what,
      "",
      "—",
      `From: ${reporter.name} <${reporter.email}>, ${reporter.role === "admin" ? "Admin" : "User"}`,
      `Page: ${input.page}`,
      `Time: ${formatMoment(at)}`,
      `Device: ${input.device}`,
      `App version: ${version}`,
      `Last error: ${lastErrorLine}`,
    ].join("\n"),
    replyTo: reporter.email,
    attachments: screenshot
      ? [{ filename: screenshot.name, content: Buffer.from(await screenshot.arrayBuffer()) }]
      : [],
  };

  try {
    if (await send(mail)) return { sent: true };
  } catch (error) {
    Sentry.captureException(error);
  }
  return { error: couldNotSend };
}
