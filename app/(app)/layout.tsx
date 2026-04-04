import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/SessionProvider";
import { Navbar } from "@/components/Navbar";
import { ToastProvider } from "@/components/Toast";

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const todayStart = getTodayStart();

  const [reservationActionRequired, latestReservationUpdate] = await Promise.all([
    isAdmin
      ? prisma.inventoryReservation.findFirst({
          where: {
            OR: [
              { status: "PENDING" },
              {
                status: "APPROVED",
                event: {
                  endDate: {
                    lt: todayStart,
                  },
                },
              },
            ],
          },
          select: { id: true },
        })
      : prisma.inventoryReservation.findFirst({
          where: {
            requestedById: userId,
            status: "APPROVED",
            event: {
              endDate: {
                lt: todayStart,
              },
            },
          },
          select: { id: true },
        }),
    isAdmin
      ? Promise.resolve(null)
      : prisma.inventoryReservation.findFirst({
          where: {
            requestedById: userId,
            status: {
              in: ["APPROVED", "REJECTED", "CANCELED", "COMPLETED"],
            },
            lastModifiedById: {
              not: userId,
            },
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
  ]);

  return (
    <SessionProvider>
      <ToastProvider>
        <div className="app-shell">
          <Navbar
            user={session.user}
            reservationsHasAttention={Boolean(reservationActionRequired)}
            reservationNotificationAt={
              latestReservationUpdate?.updatedAt.toISOString() ?? null
            }
          />
          <main className="app-main">{children}</main>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
