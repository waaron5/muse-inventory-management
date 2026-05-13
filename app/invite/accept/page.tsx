import Image from "next/image";
import Link from "next/link";
import { InviteAcceptClient } from "./InviteAcceptClient";
import { getInviteStatus } from "./actions";

function getStatusCopy(status: "missing" | "invalid" | "expired" | "used") {
  if (status === "expired") {
    return "This invite has expired. Ask an admin to send a new invite.";
  }
  if (status === "used") {
    return "This invite has already been used. Sign in with your password.";
  }
  return "This invite link is invalid. Ask an admin to send a new invite.";
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : (params.token ?? "");
  const inviteStatus = await getInviteStatus(token);

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <Image
            src="/muse-logo.png"
            alt="Muse"
            width={165}
            height={40}
            style={{ width: "auto", height: 40, objectFit: "contain" }}
            priority
          />
        </div>

        {inviteStatus.status === "valid" ? (
          <>
            <h1 className="login-title">Create your account</h1>
            <p className="invite-helper">
              Enter your name and create a password to finish setting up Muse.
            </p>
            <InviteAcceptClient token={token} email={inviteStatus.email} />
          </>
        ) : (
          <>
            <h1 className="login-title">Invite unavailable</h1>
            <p className="login-error">{getStatusCopy(inviteStatus.status)}</p>
            <Link href="/login" className="btn btn-primary login-btn">
              Go to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
