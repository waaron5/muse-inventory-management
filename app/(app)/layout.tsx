import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/SessionProvider";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import { DemoBanner } from "@/components/DemoBanner";
import { getNotificationIndicator } from "@/lib/notifications";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;
  const isAdmin = session.user.role === "ADMIN";

  const [notificationIndicator, dbUser] = await Promise.all([
    getNotificationIndicator({ userId, isAdmin }),
    prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } }),
  ]);

  return (
    <SessionProvider>
      <ToastProvider>
        <DemoBanner />
        <AppShell
          user={{ ...session.user, avatarUrl: dbUser?.avatarUrl ?? null }}
          notificationAt={notificationIndicator.latestNotificationAt}
        >
          {children}
        </AppShell>
      </ToastProvider>
    </SessionProvider>
  );
}
