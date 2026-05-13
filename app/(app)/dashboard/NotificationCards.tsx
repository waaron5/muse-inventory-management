"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardNotification } from "@/lib/notifications";
import { TopBarTitle } from "@/components/TopBarTitle";
import { approveInventoryReservation } from "@/app/(app)/inventory/reservation-actions";
import { approveGiftReservation } from "@/app/(app)/gifting/actions";
import { useToast } from "@/components/Toast";

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
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("dismissed-notifications");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const router = useRouter();

  const visibleNotifications = notifications.filter((n) => !dismissedIds.includes(n.id));

  function dismissNotification(id: string) {
    setDismissedIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      try {
        localStorage.setItem("dismissed-notifications", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function clearAll() {
    const allIds = notifications.map((n) => n.id);
    setDismissedIds((current) => {
      const next = Array.from(new Set([...current, ...allIds]));
      try {
        localStorage.setItem("dismissed-notifications", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  async function handleApprove(notification: NotificationCard) {
    const action = notification.primaryAction;
    if (!action || action.type === "open") return;

    setApprovingIds((prev) => new Set([...prev, notification.id]));
    try {
      if (action.type === "approveInventory") {
        await approveInventoryReservation(action.reservationId);
      } else {
        await approveGiftReservation(action.reservationId);
      }
      dismissNotification(notification.id);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to approve.", "error");
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(notification.id);
        return next;
      });
    }
  }

  const clearAllAction =
    visibleNotifications.length > 0 ? (
      <button type="button" className="btn btn-outline btn-sm" onClick={clearAll}>
        Clear All
      </button>
    ) : null;

  if (visibleNotifications.length === 0) {
    return (
      <>
        <TopBarTitle title="Notifications" />
        <section className="notifications-empty">
          <h2 className="notifications-empty-title">You&apos;re all caught up.</h2>
          <p className="notifications-empty-copy">{emptyCopy}</p>
        </section>
      </>
    );
  }

  return (
    <>
      <TopBarTitle title="Notifications" actions={clearAllAction} />
      <section className="notifications-section">
        <div className="notifications-list">
          {visibleNotifications.map((notification) => {
            const isApproving = approvingIds.has(notification.id);
            const action = notification.primaryAction;
            const showApproveBtn = action && action.type !== "open";

            return (
              <article
                key={notification.id}
                className={`notification-card${notification.section === "attention" ? " notification-card-attention" : ""}`}
              >
                <div className="notification-card-header">
                  <div className="notification-card-badges">
                    <span
                      className={`notif-category-pill notif-category-${notification.category.toLowerCase()}`}
                    >
                      {notification.category}
                    </span>
                    <span
                      className={`notif-status-badge notif-status-${notification.statusVariant}`}
                    >
                      {notification.statusLabel}
                    </span>
                  </div>
                  <div className="notification-card-header-end">
                    <span className="notification-timestamp">
                      {formatTimestamp(notification.timestamp)}
                    </span>
                    <button
                      type="button"
                      className="notification-dismiss-btn"
                      onClick={() => dismissNotification(notification.id)}
                      aria-label="Dismiss notification"
                    >
                      <DismissIcon />
                    </button>
                  </div>
                </div>

                <Link href={notification.href} className="notification-card-link">
                  <div
                    className={`notification-card-icon-shell notif-icon-${notification.category.toLowerCase()}`}
                  >
                    {notification.category === "Inventory" ? <InventoryIcon /> : <GiftingIcon />}
                  </div>
                  <div className="notification-card-body">
                    <p className="notification-card-description">{notification.description}</p>
                    {notification.requesterName && (
                      <p className="notification-card-requester">
                        Requested by <strong>{notification.requesterName}</strong>
                      </p>
                    )}
                    <p className="notification-card-meta">{notification.meta}</p>
                  </div>
                </Link>

                {showApproveBtn && (
                  <div className="notification-card-footer">
                    <button
                      type="button"
                      className="btn btn-sm btn-dark"
                      onClick={() => handleApprove(notification)}
                      disabled={isApproving}
                    >
                      {isApproving ? "Approving…" : action!.label}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function DismissIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M200,40H56A16,16,0,0,0,40,56V200a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,80H136V56h64ZM120,56v64H56V56ZM56,136h64v64H56Zm144,64H136V136h64v64Z" />
    </svg>
  );
}

function GiftingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M216,72H180.92c.39-.33.79-.65,1.17-1A29.53,29.53,0,0,0,192,49.57,32.62,32.62,0,0,0,158.44,16,29.53,29.53,0,0,0,137,25.91a54.94,54.94,0,0,0-9,14.48,54.94,54.94,0,0,0-9-14.48A29.53,29.53,0,0,0,97.56,16,32.62,32.62,0,0,0,64,49.57,29.53,29.53,0,0,0,73.91,71c.38.33.78.65,1.17,1H40A16,16,0,0,0,24,88v32a16,16,0,0,0,16,16v64a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V136a16,16,0,0,0,16-16V88A16,16,0,0,0,216,72ZM149,36.51a13.69,13.69,0,0,1,10-4.5h.49A16.62,16.62,0,0,1,176,49.08a13.69,13.69,0,0,1-4.5,10c-9.49,8.4-25.24,11.36-35,12.4C137.7,60.89,141,45.5,149,36.51Zm-64.09.36A16.63,16.63,0,0,1,96.59,32h.49a13.69,13.69,0,0,1,10,4.5c8.39,9.48,11.35,25.2,12.39,34.92-9.72-1-25.44-4-34.92-12.39a13.69,13.69,0,0,1-4.5-10A16.6,16.6,0,0,1,84.87,36.87ZM40,88h80v32H40Zm16,48h64v64H56Zm144,64H136V136h64Zm16-80H136V88h80v32Z" />
    </svg>
  );
}
