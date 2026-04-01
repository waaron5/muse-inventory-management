import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/SessionProvider";
import { Navbar } from "@/components/Navbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <SessionProvider>
      <div className="app-shell">
        <Navbar user={session.user} />
        <main className="app-main">{children}</main>
      </div>

      <style>{`
        .app-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f9fafb;
        }
        .app-main {
          flex: 1;
          padding: 32px 40px;
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
        }
      `}</style>
    </SessionProvider>
  );
}
