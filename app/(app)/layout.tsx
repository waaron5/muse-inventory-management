import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/SessionProvider";
import { Navbar } from "@/components/Navbar";
import { ToastProvider } from "@/components/Toast";

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
      <ToastProvider>
        <div className="app-shell">
          <Navbar user={session.user} />
          <main className="app-main">{children}</main>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
