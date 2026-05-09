import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { TopBarTitle } from "@/components/TopBarTitle";
import { NotificationPreferencesClient } from "./NotificationPreferencesClient";

function getRoleLabel(role: string) {
  if (role === "ADMIN") return "Administrator";
  return "Team Member";
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const user = await prisma.user.findUnique({
    where: { id: session?.user.id ?? "" },
    select: { emailNotificationsEnabled: true },
  });

  const emailEnabled = user?.emailNotificationsEnabled ?? true;

  return (
    <div className="settings-page">
      <TopBarTitle title="Settings" />

      <div className="settings-stack">
        <section className="detail-card settings-card">
          <div className="settings-card-head">
            <h2 className="section-title">Profile</h2>
            <p className="settings-card-copy">
              Basic account details and identity preferences for your workspace.
            </p>
          </div>

          <div className="settings-field-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="settings-name">
                Full Name
              </label>
              <input
                id="settings-name"
                className="form-input settings-readonly-input"
                defaultValue={session?.user.name}
                readOnly
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="settings-email">
                Email
              </label>
              <input
                id="settings-email"
                className="form-input settings-readonly-input"
                defaultValue={session?.user.email}
                readOnly
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="settings-role">
                Role
              </label>
              <input
                id="settings-role"
                className="form-input settings-readonly-input"
                defaultValue={getRoleLabel(session?.user.role)}
                readOnly
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="settings-timezone">
                Time Zone
              </label>
              <select id="settings-timezone" className="form-input">
                <option>Mountain Time (US)</option>
                <option>Pacific Time (US)</option>
                <option>Central Time (US)</option>
                <option>Eastern Time (US)</option>
              </select>
            </div>
          </div>
        </section>

        <section className="detail-card settings-card">
          <div className="settings-card-head">
            <h2 className="section-title">Notifications</h2>
            <p className="settings-card-copy">
              Choose which updates should be surfaced in the app and in your daily workflow.
            </p>
          </div>

          <NotificationPreferencesClient initialEmailEnabled={emailEnabled} />
        </section>

        {session?.user.role === "ADMIN" && (
          <section className="detail-card settings-card">
            <div className="settings-card-head">
              <h2 className="section-title">Team</h2>
              <p className="settings-card-copy">
                Manage who has access to Muse.
              </p>
            </div>
            <Link href="/settings/users" className="btn btn-outline" style={{ alignSelf: "flex-start" }}>
              Manage Team Members
            </Link>
          </section>
        )}

      </div>
    </div>
  );
}
