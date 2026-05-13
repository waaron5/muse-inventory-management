import { Resend } from "resend";
import { prisma } from "@/lib/db";

// In-app return reminders are handled entirely by lib/notifications.ts —
// no email is sent for those; users see them on the dashboard.

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "no-reply@example.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
let resendClient: Resend | null = null;
let resendClientInitialized = false;
let warnedMissingResendApiKey = false;

function getResendClient() {
  if (resendClientInitialized) {
    return resendClient;
  }

  resendClientInitialized = true;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    if (!warnedMissingResendApiKey) {
      warnedMissingResendApiKey = true;
      console.warn("[email] RESEND_API_KEY is not configured. Email sending is disabled.");
    }
    resendClient = null;
    return resendClient;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;

  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    return true;
  } catch (err) {
    console.error("[email] Failed to send:", err);
    return false;
  }
}

export async function getAdminEmailRecipients(): Promise<string[]> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", emailNotificationsEnabled: true },
      select: { email: true },
    });
    return admins.map((a) => a.email);
  } catch (err) {
    console.error("[email] Failed to fetch admin recipients:", err);
    return [];
  }
}

// ─── Shared template wrapper ──────────────────────────────────────────────────

function emailLayout(bodyContent: string, footerContent?: string): string {
  const footer =
    footerContent ??
    `You're receiving this because you have email notifications enabled. You can turn them off in your <a href="${APP_URL}/settings" style="color:#71717a;">account settings</a>.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="background:#111111;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Muse</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:#18181b;">
            ${bodyContent}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 20px;border-top:1px solid #f4f4f5;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">${footer}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#111111;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">${label} →</a>`;
}

function bodyText(lines: string[]): string {
  return lines
    .map((l) => `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#18181b;">${l}</p>`)
    .join("\n");
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function buildUserInviteEmail(p: { inviteUrl: string; roleLabel: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: "You've been invited to Muse",
    html: emailLayout(
      bodyText([
        "You've been invited to Muse.",
        `Your access level will be <strong>${p.roleLabel}</strong>. Use the secure link below to enter your name and create your password.`,
        "This invite expires in 48 hours.",
      ]) + ctaButton("Accept invite", p.inviteUrl),
      "You're receiving this because an administrator invited you to Muse.",
    ),
  };
}

export function buildNewInventoryRequestEmail(p: {
  requesterName: string;
  itemTitle: string;
  quantity: number;
  eventName: string;
  eventCompany: string;
  appUrl?: string;
}): { subject: string; html: string } {
  const url = p.appUrl ?? APP_URL;
  return {
    subject: `New inventory request — ${p.itemTitle}`,
    html: emailLayout(
      bodyText([
        `<strong>${p.requesterName}</strong> has requested <strong>${p.quantity}×</strong> <em>${p.itemTitle}</em> for <strong>${p.eventName}</strong>${p.eventCompany ? ` (${p.eventCompany})` : ""}.`,
        "Review and approve or reject the request in Muse.",
      ]) + ctaButton("Review request", `${url}/reservations`),
    ),
  };
}

export function buildInventoryApprovedEmail(p: {
  requesterFirstName: string;
  itemTitle: string;
  quantity: number;
  eventName: string;
  appUrl?: string;
}): { subject: string; html: string } {
  const url = p.appUrl ?? APP_URL;
  return {
    subject: `Request approved — ${p.itemTitle}`,
    html: emailLayout(
      bodyText([
        `Hi ${p.requesterFirstName},`,
        `Your request for <strong>${p.quantity}×</strong> <em>${p.itemTitle}</em> for <strong>${p.eventName}</strong> has been approved.`,
      ]) + ctaButton("View in Muse", `${url}/reservations`),
    ),
  };
}

export function buildInventoryRejectedEmail(p: {
  requesterFirstName: string;
  itemTitle: string;
  quantity: number;
  eventName: string;
  appUrl?: string;
}): { subject: string; html: string } {
  const url = p.appUrl ?? APP_URL;
  return {
    subject: `Request rejected — ${p.itemTitle}`,
    html: emailLayout(
      bodyText([
        `Hi ${p.requesterFirstName},`,
        `Your request for <strong>${p.quantity}×</strong> <em>${p.itemTitle}</em> for <strong>${p.eventName}</strong> was not approved.`,
        "Contact an admin if you have questions.",
      ]) + ctaButton("View in Muse", `${url}/reservations`),
    ),
  };
}

export function buildInventoryReturnedEmail(p: {
  requesterName: string;
  itemTitle: string;
  quantity: number;
  eventName: string;
  returnLocation: string;
  appUrl?: string;
}): { subject: string; html: string } {
  const url = p.appUrl ?? APP_URL;
  return {
    subject: `Item returned — ${p.itemTitle}`,
    html: emailLayout(
      bodyText([
        `<strong>${p.requesterName}</strong> has returned <strong>${p.quantity}×</strong> <em>${p.itemTitle}</em> from <strong>${p.eventName}</strong>.`,
        `Return location: <strong>${p.returnLocation}</strong>`,
      ]) + ctaButton("View in Muse", `${url}/reservations`),
    ),
  };
}

export function buildBulkReturnSummaryEmail(p: {
  items: { itemTitle: string; quantity: number; eventName: string }[];
  returnLocation: string;
  returnedByName: string;
  appUrl?: string;
}): { subject: string; html: string } {
  const url = p.appUrl ?? APP_URL;
  const rows = p.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 12px 6px 0;font-size:14px;color:#18181b;">${i.quantity}× ${i.itemTitle}</td><td style="padding:6px 0;font-size:14px;color:#71717a;">${i.eventName}</td></tr>`,
    )
    .join("");
  const table = `<table style="width:100%;border-collapse:collapse;margin:16px 0 4px;"><thead><tr><th style="text-align:left;padding:6px 12px 6px 0;font-size:12px;color:#71717a;font-weight:600;border-bottom:1px solid #e4e4e7;">Item</th><th style="text-align:left;padding:6px 0;font-size:12px;color:#71717a;font-weight:600;border-bottom:1px solid #e4e4e7;">Event</th></tr></thead><tbody>${rows}</tbody></table>`;
  return {
    subject: `${p.items.length} item${p.items.length !== 1 ? "s" : ""} returned by ${p.returnedByName}`,
    html: emailLayout(
      bodyText([
        `<strong>${p.returnedByName}</strong> has returned ${p.items.length} item${p.items.length !== 1 ? "s" : ""} to <strong>${p.returnLocation}</strong>.`,
      ]) +
        table +
        ctaButton("View in Muse", `${url}/reservations`),
    ),
  };
}

export function buildNewGiftRequestEmail(p: {
  requesterName: string;
  itemTitle: string;
  quantity: number;
  eventName: string;
  eventCompany: string;
  appUrl?: string;
}): { subject: string; html: string } {
  const url = p.appUrl ?? APP_URL;
  return {
    subject: `New gift request — ${p.itemTitle}`,
    html: emailLayout(
      bodyText([
        `<strong>${p.requesterName}</strong> has requested <strong>${p.quantity}×</strong> <em>${p.itemTitle}</em> for <strong>${p.eventName}</strong>${p.eventCompany ? ` (${p.eventCompany})` : ""}.`,
        "Review and approve or reject the request in Muse.",
      ]) + ctaButton("Review request", `${url}/gifting`),
    ),
  };
}

export function buildGiftApprovedEmail(p: {
  requesterFirstName: string;
  itemTitle: string;
  quantity: number;
  eventName: string;
  appUrl?: string;
}): { subject: string; html: string } {
  const url = p.appUrl ?? APP_URL;
  return {
    subject: `Gift request approved — ${p.itemTitle}`,
    html: emailLayout(
      bodyText([
        `Hi ${p.requesterFirstName},`,
        `Your request for <strong>${p.quantity}×</strong> <em>${p.itemTitle}</em> for <strong>${p.eventName}</strong> has been approved.`,
      ]) + ctaButton("View in Muse", `${url}/reservations`),
    ),
  };
}

export function buildGiftRejectedEmail(p: {
  requesterFirstName: string;
  itemTitle: string;
  quantity: number;
  eventName: string;
  appUrl?: string;
}): { subject: string; html: string } {
  const url = p.appUrl ?? APP_URL;
  return {
    subject: `Gift request rejected — ${p.itemTitle}`,
    html: emailLayout(
      bodyText([
        `Hi ${p.requesterFirstName},`,
        `Your request for <strong>${p.quantity}×</strong> <em>${p.itemTitle}</em> for <strong>${p.eventName}</strong> was not approved.`,
        "Contact an admin if you have questions.",
      ]) + ctaButton("View in Muse", `${url}/reservations`),
    ),
  };
}
