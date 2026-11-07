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

/**
 * What happened, and where it was: on a page of the app, with its device, last
 * error and optional screenshot; or through an AI app, named.
 */
export type BugReportInput = { what: string } & (
  | { page: string; device: string; lastError?: PageError; screenshot?: File | null }
  | { via: string }
);

// The deploy a report came from, as Sentry's releases name it.
export const appVersion = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

export type BugReportState = { error?: string; sent?: boolean };

/**
 * Emails a bug report to the maintainer with its context attached: who, page,
 * time, device, app version, and the last error with its tracker ID; or, from
 * an AI app, which app in place of page, device and error. Nothing is stored;
 * a failure to send is reported to Sentry, and the reporter is told so.
 */
export async function sendBugReport(
  send: SendBugMail,
  reporter: Reporter,
  input: BugReportInput,
  { at, version }: { at: Date; version: string },
): Promise<BugReportState> {
  const what = input.what.trim();
  if (!what) return { error: "Say what happened." };
  const screenshot = "page" in input && input.screenshot?.size ? input.screenshot : null;
  if (screenshot && (!screenshot.type.startsWith("image/") || screenshot.size >= screenshotLimit)) {
    return { error: screenshotRefused };
  }

  const mail: BugMail = {
    subject: `Bug report from ${reporter.name}: ${what.split("\n")[0].slice(0, 80)}`,
    text: [
      what,
      "",
      "—",
      `From: ${reporter.name} <${reporter.email}>, ${reporter.role === "admin" ? "Admin" : "User"}`,
      ...("page" in input
        ? [`Page: ${input.page}`, `Time: ${formatMoment(at)}`, `Device: ${input.device}`, `App version: ${version}`, `Last error: ${lastErrorLine(input.lastError)}`]
        : [`Reported via ${input.via}`, `Time: ${formatMoment(at)}`, `App version: ${version}`]),
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

function lastErrorLine(lastError: PageError | undefined) {
  if (!lastError) return "none";
  return `${lastError.message}${lastError.trackerId ? ` (tracker ID ${lastError.trackerId})` : ""}`;
}
