"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

export function NotificationCards({ notifications, emptyCopy }: NotificationCardsProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dismissed-notifications");
      if (stored) setDismissedIds(JSON.parse(stored));
    } catch {
      // ignore — corrupt storage, start fresh
    }
  }, []);

  const visibleNotifications = notifications.filter(
    (notification) => !dismissedIds.includes(notification.id),
  );

  function dismissNotification(id: string) {
    setDismissedIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      try {
        localStorage.setItem("dismissed-notifications", JSON.stringify(next));
      } catch {
        // ignore — storage quota or private browsing
      }
      return next;
    });
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
          const timestamp = formatTimestamp(notification.timestamp);

          return (
            <article
              key={notification.id}
              className={`notification-card${
                notification.section === "attention" ? " notification-card-attention" : ""
              }`}
            >
              <Link href={notification.href} className="notification-card-main">
                <div className="notification-card-icon-shell" aria-hidden="true">
                  <NotificationAttentionIcon className="notification-card-icon" />
                </div>
                <div className="notification-card-copy">
                  <h3 className="notification-card-title">{notification.title}</h3>
                  <p className="notification-card-supporting">
                    <span>{notification.description}</span>
                    {notification.requesterName ? (
                      <>
                        <span className="notification-card-supporting-separator" aria-hidden="true">
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
                    <span className="notification-card-supporting-separator" aria-hidden="true">
                      •
                    </span>
                    <span className="notification-card-supporting-detail">{notification.meta}</span>
                    <span className="notification-card-supporting-separator" aria-hidden="true">
                      •
                    </span>
                    <span className="notification-card-supporting-detail">{timestamp}</span>
                  </p>
                </div>
              </Link>

              <div className="notification-card-actions">
                <button
                  type="button"
                  className="notification-card-close"
                  onClick={() => dismissNotification(notification.id)}
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

function NotificationAttentionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M10 3.2L17.3 16H2.7L10 3.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 8V11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1" fill="currentColor" />
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
