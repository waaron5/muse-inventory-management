import { getServerSession } from "next-auth";
import Link from "next/link";
import { TopBarTitle } from "@/components/TopBarTitle";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NotificationPreferencesClient } from "./NotificationPreferencesClient";
import { ProfileSettingsClient } from "./ProfileSettingsClient";

function getRoleLabel(role: string) {
  if (role === "ADMIN") return "Administrator";
  return "Team Member";
}

function getProfileNameParts(user: {
  firstName: string | null;
  lastName: string | null;
  name: string;
}) {
  if (user.firstName || user.lastName) {
    return {
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
    };
  }

  const [firstName = "", ...rest] = user.name.trim().split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      emailNotificationsEnabled: true,
      avatarUrl: true,
    },
  });

  if (!user) return null;

  const isAdmin = user.role === "ADMIN";
  const emailEnabled = user.emailNotificationsEnabled;
  const profileNameParts = getProfileNameParts(user);

  return (
    <div className="settings-page">
      <TopBarTitle title="Settings" />

      <div className={`settings-grid${isAdmin ? "" : " settings-grid-single"}`}>
        <div className="settings-main">
          <section className="detail-card settings-card">
            <div className="settings-card-head">
              <h2 className="section-title">Profile</h2>
            </div>

            <ProfileSettingsClient
              firstName={profileNameParts.firstName}
              lastName={profileNameParts.lastName}
              email={user.email}
              roleLabel={getRoleLabel(user.role)}
              avatarUrl={user.avatarUrl ?? null}
            />
          </section>

          <section className="detail-card settings-card">
            <div className="settings-card-head">
              <h2 className="section-title">Notifications</h2>
            </div>

            <NotificationPreferencesClient initialEmailEnabled={emailEnabled} />
          </section>
        </div>

        {isAdmin && (
          <aside className="detail-side settings-team-card">
            <div className="settings-card-head">
              <h2 className="section-title">Team</h2>
            </div>

            <div className="settings-team-summary">
              <span className="settings-team-label">Your access</span>
              <span className="settings-team-value">{getRoleLabel(user.role)}</span>
            </div>

            <Link href="/settings/users" className="btn btn-outline settings-team-link">
              Manage Team Members
            </Link>
          </aside>
        )}
      </div>
    </div>
  );
}
