import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { DetailTopBar } from "@/components/DetailTopBar";
import { CreateUserForm } from "./CreateUserForm";

function getRoleLabel(role: string) {
  return role === "ADMIN" ? "Administrator" : "Team Member";
}

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/settings");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <DetailTopBar
        crumbs={[{ label: "Settings", href: "/settings" }, { label: "Team Members" }]}
      />

      <div className="settings-page">
        <div className="settings-stack">
          <section className="detail-card settings-card">
            <div className="settings-card-head">
              <h2 className="section-title">Team Members</h2>
              <p className="settings-card-copy">
                All users who can access Muse. Only admins can create new accounts.
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
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                    <td style={{ padding: "10px 0", color: "var(--gray-900)", fontWeight: 500 }}>
                      {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.name}
                    </td>
                    <td style={{ padding: "10px 0", color: "var(--gray-600)" }}>{u.email}</td>
                    <td style={{ padding: "10px 0", color: "var(--gray-600)" }}>
                      {getRoleLabel(u.role)}
                    </td>
                    <td style={{ padding: "10px 0", color: "var(--gray-500)", fontSize: 13 }}>
                      {u.createdAt.toLocaleDateString("en-US", {
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

          <section className="detail-card settings-card">
            <div className="settings-card-head">
              <h2 className="section-title">Create New User</h2>
              <p className="settings-card-copy">
                Add a team member. Share their email and initial password with them directly.
              </p>
            </div>
            <CreateUserForm />
          </section>
        </div>
      </div>
    </>
  );
}
