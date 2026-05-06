import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TopBarTitle } from "@/components/TopBarTitle";
import { getDashboardNotifications } from "@/lib/notifications";
import { NotificationCards } from "./NotificationCards";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isAdmin = session.user.role === "ADMIN";
  const notifications = await getDashboardNotifications({
    userId: session.user.id,
    isAdmin,
  });
  const emptyCopy = isAdmin
    ? "New reservation requests and overdue returns will appear here."
    : "Reservation updates and reminders will appear here.";

  return (
    <div className="notifications-page">
      <TopBarTitle title="Notifications" />
      <NotificationCards
        notifications={notifications.map((notification) => ({
          ...notification,
          timestamp: notification.timestamp.toISOString(),
        }))}
        emptyCopy={emptyCopy}
      />
    </div>
  );
}
