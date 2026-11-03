import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as Sentry from "@sentry/nextjs";
import { Resend } from "resend";
import type { SendCodeEmail } from "./auth/create-auth";
import type { SendBugMail } from "./bug-report";
import { codeEmail } from "./code-email";

/** Where mail lands when there is no Resend key: read by the Playwright smoke. */
export const LOCAL_OUTBOX = path.join(process.cwd(), ".outbox", "mail.jsonl");

// The domain must be verified in Resend. Its test sender only delivers to the
// account owner, so it must never be the app's default.
const DEFAULT_FROM = "Muse Inventory <no-reply@inventory.museem.com>";

type Mail = {
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
};
/** Where a mail went: Resend took it, it only reached the local outbox, or it didn't go. */
export type Delivery = "emailed" | "outbox" | "failed";
// `logged` is kept beside the mail in the local outbox only.
type Transport = (to: string, mail: Mail, logged?: Record<string, string>) => Promise<Delivery>;

/**
 * Whether mail here only reaches the local outbox: a laptop with no Resend key.
 * Screens say so, or a code or invite would seem to have been emailed.
 */
export function mailGoesToOutbox(): boolean {
  return !process.env.RESEND_API_KEY && !process.env.VERCEL;
}

/**
 * Sends sign-in codes through Resend, or to the console and a local outbox.
 * The email's header picture is served from `appURL`.
 */
export function codeMailerFromEnv(appURL: string): SendCodeEmail {
  const send = transportFromEnv("a sign-in code");
  if (!send) {
    return async () => {
      throw new Error("RESEND_API_KEY is not set, so no sign-in code can be sent.");
    };
  }
  // Whether it went is never surfaced to the person: a failure only for
  // invited addresses would tell which ones exist.
  return async (to, code) => {
    await send(to, codeEmail(code, appURL), { code });
  };
}

/** Tells someone they've been invited, and where to sign in; says where it went. */
export function inviteMailerFromEnv(appURL: string): (to: string) => Promise<Delivery> {
  const send = transportFromEnv("an invite");
  return async (to) => (send ? send(to, inviteEmail(appURL)) : "failed");
}

/**
 * Emails a bug report to the maintainer address in config; says whether it
 * went. Missing config is reported, so a report never vanishes unnoticed.
 */
export function bugReportMailerFromEnv(): SendBugMail {
  const send = transportFromEnv("a bug report");
  const to = process.env.MAINTAINER_EMAIL;
  return async (mail) => {
    if (!send || !to) {
      Sentry.captureException(new Error("A bug report can't be sent: RESEND_API_KEY or MAINTAINER_EMAIL is not set."));
      return false;
    }
    const delivery = await send(to, mail, {
      text: mail.text,
      replyTo: mail.replyTo,
      attachments: mail.attachments.map((a) => a.filename).join(", "),
    });
    return delivery !== "failed";
  };
}

// Resend, or on a laptop the console and a local outbox; none on Vercel without
// a key. A failure is reported without the address.
function transportFromEnv(what: string): Transport | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const from = process.env.MAIL_FROM || DEFAULT_FROM;
    return async (to, mail) => {
      const { error } = await resend.emails.send({ from, to, ...mail });
      if (!error) return "emailed";
      Sentry.captureException(new Error(`Resend refused ${what}: ${error.name}`));
      console.error(JSON.stringify({ at: "mail", error: error.name, message: error.message }));
      return "failed";
    };
  }
  if (process.env.VERCEL) return null;
  return async (to, mail, logged = {}) => {
    console.info(`Mail to ${to}: ${mail.subject}`);
    await mkdir(path.dirname(LOCAL_OUTBOX), { recursive: true });
    await appendFile(
      LOCAL_OUTBOX,
      `${JSON.stringify({ to, subject: mail.subject, ...logged, at: new Date().toISOString() })}\n`,
    );
    return "outbox";
  };
}

// No link that expires: the invite stands until an Admin deactivates them.
function inviteEmail(appURL: string): Mail {
  return {
    subject: "You've been added to Muse Inventory",
    text: [
      "You've been added to Muse Inventory, where Muse keeps track of its gear and gifts.",
      "",
      `Sign in at ${appURL} with this email address, and we'll email you a code.`,
    ].join("\n"),
  };
}
