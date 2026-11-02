import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as Sentry from "@sentry/nextjs";
import { Resend } from "resend";
import type { SendCodeEmail } from "./auth/create-auth";
import type { SendBugMail } from "./bug-report";

/** Where mail lands when there is no Resend key: read by the Playwright smoke. */
export const LOCAL_OUTBOX = path.join(process.cwd(), ".outbox", "mail.jsonl");

// The domain must be verified in Resend. Its test sender only delivers to the
// account owner, so it must never be the app's default.
const DEFAULT_FROM = "Muse Inventory <no-reply@inventory.museem.com>";

type Mail = {
  subject: string;
  text: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
};
// `logged` is kept beside the mail in the local outbox only.
type Transport = (to: string, mail: Mail, logged?: Record<string, string>) => Promise<boolean>;

/** Sends sign-in codes through Resend, or to the console and a local outbox. */
export function codeMailerFromEnv(): SendCodeEmail {
  const send = transportFromEnv("a sign-in code");
  if (!send) {
    return async () => {
      throw new Error("RESEND_API_KEY is not set, so no sign-in code can be sent.");
    };
  }
  // Whether it went is never surfaced to the person: a failure only for
  // invited addresses would tell which ones exist.
  return async (to, code) => {
    await send(to, codeEmail(code), { code });
  };
}

/** Tells someone they've been invited, and where to sign in; says whether it went. */
export function inviteMailerFromEnv(appURL: string): (to: string) => Promise<boolean> {
  const send = transportFromEnv("an invite");
  return async (to) => (send ? send(to, inviteEmail(appURL)) : false);
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
    return send(to, mail, {
      text: mail.text,
      replyTo: mail.replyTo,
      attachments: mail.attachments.map((a) => a.filename).join(", "),
    });
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
      if (!error) return true;
      Sentry.captureException(new Error(`Resend refused ${what}: ${error.name}`));
      console.error(JSON.stringify({ at: "mail", error: error.name, message: error.message }));
      return false;
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
    return true;
  };
}

function codeEmail(code: string): Mail {
  return {
    subject: `${code} is your Muse Inventory code`,
    text: [
      `Your Muse Inventory sign-in code is ${code}.`,
      "",
      "It works for 5 minutes. If you didn't ask for it, you can ignore this email.",
    ].join("\n"),
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
