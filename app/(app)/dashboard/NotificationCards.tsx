"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { approveGiftReservation } from "@/app/(app)/gifting/actions";
import { approveInventoryReservation } from "@/app/(app)/inventory/reservation-actions";
import type { DashboardNotification } from "@/lib/notifications";

type NotificationCard = Omit<DashboardNotification, "timestamp"> & {
  timestamp: string;
};

interface NotificationCardsProps {
  notifications: NotificationCard[];
  emptyCopy: string;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function NotificationCards({
  notifications,
  emptyCopy,
}: NotificationCardsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const visibleNotifications = notifications.filter(
    (notification) => !dismissedIds.includes(notification.id)
  );

  function dismissNotification(id: string) {
    setDismissedIds((current) =>
      current.includes(id) ? current : [...current, id]
    );
  }

  async function handleApprove(notification: NotificationCard) {
    if (!notification.primaryAction) return;

    setLoadingId(notification.id);
    try {
      if (notification.primaryAction.type === "approveInventory") {
        await approveInventoryReservation(notification.primaryAction.reservationId);
        toast("Reservation approved");
      } else if (notification.primaryAction.type === "approveGift") {
        await approveGiftReservation(notification.primaryAction.reservationId);
        toast("Gift request approved");
      }

      dismissNotification(notification.id);
      router.refresh();
    } catch (error: unknown) {
      toast(
        error instanceof Error ? error.message : "Failed to update notification",
        "error"
      );
    } finally {
      setLoadingId(null);
    }
  }

  if (visibleNotifications.length === 0) {
    return (
      <section className="notifications-empty">
        <h2 className="notifications-empty-title">You&apos;re all caught up.</h2>
        <p className="notifications-empty-copy">{emptyCopy}</p>
      </section>
    );
  }

  return (
    <section className="notifications-section">
      <div className="notifications-list">
        {visibleNotifications.map((notification) => {
          const action = notification.primaryAction;
          const isApproving =
            loadingId === notification.id &&
            (action?.type === "approveInventory" ||
              action?.type === "approveGift");
          const timestamp = formatTimestamp(notification.timestamp);

          return (
            <article
              key={notification.id}
              className={`notification-card${
                notification.section === "attention"
                  ? " notification-card-attention"
                  : ""
              }`}
            >
              <Link href={notification.href} className="notification-card-main">
                <div className="notification-card-icon-shell" aria-hidden="true">
                  <NotificationInfoIcon className="notification-card-icon" />
                </div>
                <div className="notification-card-copy">
                  <h3 className="notification-card-title">{notification.title}</h3>
                  <p className="notification-card-supporting">
                    <span>{notification.description}</span>
                    {notification.requesterName ? (
                      <>
                        <span
                          className="notification-card-supporting-separator"
                          aria-hidden="true"
                        >
                          •
                        </span>
                        <span className="notification-card-supporting-detail">
                          Requested by{" "}
                          <span className="notification-card-supporting-strong">
                            {notification.requesterName}
                          </span>
                        </span>
                      </>
                    ) : null}
                    <span
                      className="notification-card-supporting-separator"
                      aria-hidden="true"
                    >
                      •
                    </span>
                    <span className="notification-card-supporting-detail">
                      {notification.meta}
                    </span>
                    <span
                      className="notification-card-supporting-separator"
                      aria-hidden="true"
                    >
                      •
                    </span>
                    <span className="notification-card-supporting-detail">
                      {timestamp}
                    </span>
                  </p>
                </div>
              </Link>

              <div className="notification-card-actions">
                {action?.type === "approveInventory" ||
                action?.type === "approveGift" ? (
                  <button
                    type="button"
                    className="notification-card-primary-action"
                    onClick={() => void handleApprove(notification)}
                    disabled={loadingId !== null}
                  >
                    {isApproving ? "Approving..." : action.label}
                  </button>
                ) : null}

                {action?.type === "open" ? (
                  <Link
                    href={action.href}
                    className="notification-card-primary-action"
                  >
                    {action.label}
                  </Link>
                ) : null}

                <button
                  type="button"
                  className="notification-card-close"
                  onClick={() => dismissNotification(notification.id)}
                  disabled={loadingId === notification.id}
                  aria-label={`Close ${notification.title.toLowerCase()} notification`}
                >
                  <CloseIcon className="notification-card-close-icon" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function NotificationInfoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="10"
        cy="10"
        r="7.25"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10 8.2V13.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="10" cy="5.8" r="1" fill="currentColor" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
