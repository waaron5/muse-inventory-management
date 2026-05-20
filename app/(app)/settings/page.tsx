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

          <section className="detail-card settings-card">
            <div className="settings-card-head">
              <h2 className="section-title">Team Members</h2>
              <p className="settings-card-copy">
                Everyone with access to Muse. Administrators can manage invitations and access.
              </p>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--gray-200)" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 0",
                      fontWeight: 600,
                      color: "var(--gray-500)",
                      fontSize: 12,
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 0",
                      fontWeight: 600,
                      color: "var(--gray-500)",
                      fontSize: 12,
                    }}
                  >
                    Email
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 0",
                      fontWeight: 600,
                      color: "var(--gray-500)",
                      fontSize: 12,
                    }}
                  >
                    Role
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 0",
                      fontWeight: 600,
                      color: "var(--gray-500)",
                      fontSize: 12,
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 0",
                      fontWeight: 600,
                      color: "var(--gray-500)",
                      fontSize: 12,
                    }}
                  >
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((teamMember) => (
                  <tr key={teamMember.id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                    <td style={{ padding: "10px 0", color: "var(--gray-900)", fontWeight: 500 }}>
                      {getDisplayName(teamMember)}
                    </td>
                    <td style={{ padding: "10px 0", color: "var(--gray-600)" }}>
                      {teamMember.email}
                    </td>
                    <td style={{ padding: "10px 0", color: "var(--gray-600)" }}>
                      {getRoleLabel(teamMember.role)}
                    </td>
                    <td style={{ padding: "10px 0", color: "var(--gray-600)" }}>
                      {teamMember.passwordSetAt ? "Active" : "Invited"}
                    </td>
                    <td style={{ padding: "10px 0", color: "var(--gray-500)", fontSize: 13 }}>
                      {teamMember.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
