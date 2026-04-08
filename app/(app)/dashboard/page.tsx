import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getDashboardNotifications,
  getFirstName,
  type DashboardNotification,
} from "@/lib/notifications";

function formatTimestamp(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isAdmin = session.user.role === "ADMIN";
  const firstName = getFirstName(session.user.name, session.user.email);
  const notifications = await getDashboardNotifications({
    userId: session.user.id,
    isAdmin,
  });

  const attentionNotifications = notifications.filter(
    (notification) => notification.section === "attention"
  );
  const updateNotifications = notifications.filter(
    (notification) => notification.section === "updates"
  );

  return (
    <div className="notifications-page">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle={
          isAdmin
            ? "New requests and return reminders show up here."
            : "Approvals, changes, and return reminders show up here."
        }
      />

      <div className="notifications-summary">
        <span className="notifications-count">
          {notifications.length === 0
            ? "No notifications right now"
            : `${notifications.length} notification${
                notifications.length === 1 ? "" : "s"
              }`}
        </span>
        {attentionNotifications.length > 0 && (
          <span className="notifications-summary-pill">
            {attentionNotifications.length} need attention
          </span>
        )}
      </div>

      {notifications.length === 0 ? (
        <section className="notifications-empty">
          <h2 className="notifications-empty-title">You&apos;re all caught up.</h2>
          <p className="notifications-empty-copy">
            {isAdmin
              ? "New reservation requests and overdue returns will appear here."
              : "Reservation updates and reminders will appear here."}
          </p>
        </section>
      ) : (
        <div className="notifications-sections">
          {attentionNotifications.length > 0 && (
            <NotificationSection
              title="Needs Attention"
              notifications={attentionNotifications}
            />
          )}
          {updateNotifications.length > 0 && (
            <NotificationSection
              title="Recent Updates"
              notifications={updateNotifications}
            />
          )}
        </div>
      )}
    </div>
  );
}

function NotificationSection({
  title,
  notifications,
}: {
  title: string;
  notifications: DashboardNotification[];
}) {
  return (
    <section className="notifications-section">
      <div className="notifications-section-header">
        <h2 className="notifications-section-title">{title}</h2>
        <span className="notifications-section-count">
          {notifications.length}
        </span>
      </div>

      <div className="notifications-list">
        {notifications.map((notification) => (
          <Link
            key={notification.id}
            href={notification.href}
            className={`notification-card${
              notification.section === "attention"
                ? " notification-card-attention"
                : ""
            }`}
          >
            <div className="notification-card-top">
              <div className="notification-card-badges">
                <StatusBadge
                  variant={notification.statusVariant}
                  label={notification.statusLabel}
                />
                <span className="notification-card-category">
                  {notification.category}
                </span>
              </div>
              <span className="notification-card-time">
                {formatTimestamp(notification.timestamp)}
              </span>
            </div>

            <h3 className="notification-card-title">{notification.title}</h3>
            <p className="notification-card-message">{notification.message}</p>
            <p className="notification-card-meta">{notification.meta}</p>

            <span className="notification-card-action">
              {notification.actionLabel} <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
