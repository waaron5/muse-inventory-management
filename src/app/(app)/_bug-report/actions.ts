"use server";

import { headers } from "next/headers";
import { isDemo, offInTheDemo } from "@/lib/demo";
import { currentSession } from "@/server/auth";
import { appVersion, type BugReportState, sendBugReport } from "@/server/bug-report";
import { bugReportMailerFromEnv } from "@/server/mail";

const sendBugMail = bugReportMailerFromEnv();

/** Report a bug: emailed to the maintainer, with who, device and version read here. */
export async function reportBug(form: FormData): Promise<BugReportState> {
  const session = await currentSession();
  if (!session) return { error: "Sign in again to continue." };
  // A stranger's report would reach the maintainer's inbox (ADR 0016).
  if (isDemo()) return { error: offInTheDemo("Bug reports") };
  const text = (key: string) => String(form.get(key) ?? "");
  const screenshot = form.get("screenshot");
  return sendBugReport(
    sendBugMail,
    session.user,
    {
      what: text("what"),
      page: text("page"),
      device: (await headers()).get("user-agent") ?? "unknown",
      lastError: text("lastError") ? { message: text("lastError"), trackerId: text("trackerId") || undefined } : undefined,
      screenshot: screenshot instanceof File ? screenshot : null,
    },
    { at: new Date(), version: appVersion },
  );
}
