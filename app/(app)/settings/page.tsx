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

function getDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  name: string;
  passwordSetAt: Date | null;
}) {
  if (!user.passwordSetAt) return "Pending invite";
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  return user.name;
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const [user, teamMembers] = await Promise.all([
    prisma.user.findUnique({
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
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        passwordSetAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!user) return null;

  const isAdmin = user.role === "ADMIN";
  const emailEnabled = user.emailNotificationsEnabled;
  const profileNameParts = getProfileNameParts(user);

  return (
    <div className="settings-page">
      <TopBarTitle title="Settings" />

      <div className="settings-grid">
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

        <aside className="detail-side settings-team-card">
          <div className="settings-card-head">
            <h2 className="section-title">Team</h2>
            <p className="settings-card-copy">Everyone with access to Muse.</p>
          </div>

          <div className="settings-team-summary">
            <span className="settings-team-label">Your access</span>
            <span className="settings-team-value">{getRoleLabel(user.role)}</span>
          </div>

          <div className="settings-team-members-list">
            {teamMembers.map((teamMember) => (
              <div className="settings-team-member-row" key={teamMember.id}>
                <div className="settings-team-member-main">
                  <span className="settings-team-member-name">{getDisplayName(teamMember)}</span>
                  <span className="settings-team-member-email">{teamMember.email}</span>
                </div>
                <span className="settings-team-member-role">{getRoleLabel(teamMember.role)}</span>
              </div>
            ))}
          </div>

          {isAdmin && (
            <Link href="/settings/users" className="btn btn-outline settings-team-link">
              Manage Team Members
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
