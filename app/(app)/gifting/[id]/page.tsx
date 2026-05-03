import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DetailTopBar } from "@/components/DetailTopBar";
import { GiftReservationRowActions } from "@/components/GiftReservationRowActions";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/db";
import {
  getGiftReservationStatusLabel,
  getGiftReservationStatusVariant,
} from "@/lib/gift-reservation-ui";
import { GiftDetailActions } from "./GiftDetailActions";
import { GiftHeaderActions } from "./GiftHeaderActions";

export default async function GiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session?.user.id ?? "";
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const item = await prisma.giftItem.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      reservations: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          event: {
            select: {
              companyName: true,
              eventName: true,
              startDate: true,
              endDate: true,
            },
          },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!item) notFound();

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "GIFT_ITEM", entityId: id },
    orderBy: { timestamp: "desc" },
    take: 20,
    include: { performedBy: { select: { name: true } } },
  });

  const activeReservations = item.reservations.filter((reservation) =>
    ["PENDING", "APPROVED"].includes(reservation.status)
  );
  const useHistory = item.reservations.filter(
    (reservation) => !["PENDING", "APPROVED"].includes(reservation.status)
  );
  const availableEvents = await prisma.event.findMany({
    where: { endDate: { gte: todayStart } },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      eventName: true,
      companyName: true,
      location: true,
      startDate: true,
      endDate: true,
    },
  });

  return (
    <>
      <DetailTopBar
        crumbs={[
          { label: "Gifting", href: "/gifting" },
          { label: item.title },
        ]}
        actions={isAdmin ? <GiftHeaderActions itemId={id} itemTitle={item.title} /> : undefined}
      />

      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-card">
            <div className="detail-image-section">
              {item.imageUrl ? (
                <div className="detail-image-frame">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="detail-image-img"
                  />
                </div>
              ) : (
                <div className="image-placeholder-lg" />
              )}
            </div>

            <div className="detail-fields">
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <StatusBadge variant={item.status === "ACTIVE" ? "active" : "consumed"} />
              </div>
              <div className="detail-row">
                <span className="detail-label">Total Quantity</span>
                <span>{item.quantity}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Location</span>
                <span>{item.currentLocation ?? "—"}</span>
              </div>
              <div className="detail-row detail-row-block">
                <span className="detail-label">Availability</span>
                <p className="detail-notes">
                  Approved requests reduce current gift stock. Once marked used,
                  gifts are consumed and cannot be returned.
                </p>
              </div>
              {item.notes && (
                <div className="detail-row detail-row-block">
                  <span className="detail-label">Notes</span>
                  <p className="detail-notes">{item.notes}</p>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Created by</span>
                <span>{item.createdBy?.name ?? "—"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last Updated</span>
                <span>
                  {item.updatedAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {item.updatedBy && ` by ${item.updatedBy.name}`}
                </span>
              </div>
            </div>
          </div>

          <div className="reservations-section">
            <h3 className="section-title">
              Active Requests ({activeReservations.length})
            </h3>
            {activeReservations.length === 0 ? (
              <p className="empty-hint">No active requests.</p>
            ) : (
              <table className="res-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date Range</th>
                    <th>Qty</th>
                    <th>Status</th>
                    <th>Requested By</th>
                    <th className="res-actions-header">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>
                        <div className="reservation-event-cell">
                          <Link
                            href={`/events/${reservation.eventId}`}
                            className="event-title-link"
                          >
                            {reservation.event.eventName}
                          </Link>
                          <span className="reservation-event-meta">
                            {reservation.event.companyName}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="reservation-date-primary">
                          {reservation.event.startDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          {" – "}
                          {reservation.event.endDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </td>
                      <td>{reservation.quantity}</td>
                      <td>
                        <StatusBadge
                          variant={getGiftReservationStatusVariant(reservation.status)}
                          label={getGiftReservationStatusLabel(reservation.status)}
                        />
                      </td>
                      <td className="text-muted">{reservation.requestedBy.name}</td>
                      <td className="res-actions-cell">
                        <GiftReservationRowActions
                          reservation={{
                            id: reservation.id,
                            status: reservation.status,
                            giftItemId: item.id,
                            requestedById: reservation.requestedBy.id,
                          }}
                          isAdmin={isAdmin}
                          fallbackHref={`/events/${reservation.eventId}`}
                          fallbackLabel="View Event"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="detail-side">
          <h3 className="section-title">Use History</h3>
          {useHistory.length === 0 ? (
            <p className="empty-hint">No past usage history.</p>
          ) : (
            <div className="reservation-list">
              {useHistory.map((reservation) => (
                <div key={reservation.id} className="reservation-card">
                  <div className="res-top">
                    <span className="res-event">{reservation.event.eventName}</span>
                    <StatusBadge
                      variant={getGiftReservationStatusVariant(reservation.status)}
                      label={getGiftReservationStatusLabel(reservation.status)}
                    />
                  </div>
                  <div className="res-meta">
                    {reservation.event.companyName} ·{" "}
                    {reservation.event.startDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {" – "}
                    {reservation.event.endDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div className="res-meta">
                    Qty: {reservation.quantity} · By: {reservation.requestedBy.name}
                    {reservation.approvedBy && ` · Approved: ${reservation.approvedBy.name}`}
                  </div>
                  {reservation.notes && <p className="res-notes">{reservation.notes}</p>}
                </div>
              ))}
            </div>
          )}

          <h3 className="section-title" style={{ marginTop: 28 }}>
            Change History
          </h3>
          {auditLogs.length === 0 ? (
            <p className="empty-hint">No history recorded.</p>
          ) : (
            <div className="audit-list">
              {auditLogs.map((log) => (
                <div key={log.id} className="audit-row">
                  <span className="audit-action">{log.actionType.replace("_", " ")}</span>
                  <span className="audit-meta">
                    {log.performedBy.name} ·{" "}
                    {log.timestamp.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <p className="audit-summary">{log.summary}</p>
                </div>
              ))}
            </div>
          )}

          {item.status === "ACTIVE" && item.quantity > 0 && (
            <div className="detail-side-action">
              <GiftDetailActions
                itemId={item.id}
                itemTitle={item.title}
                itemTotalQuantity={item.quantity}
                userId={userId}
                activeReservations={activeReservations.map((reservation) => ({
                  status: reservation.status,
                  requestedById: reservation.requestedBy.id,
                }))}
                availableEvents={availableEvents.map((event) => ({
                  id: event.id,
                  eventName: event.eventName,
                  companyName: event.companyName,
                  location: event.location,
                  startDate: event.startDate.toISOString(),
                  endDate: event.endDate.toISOString(),
                }))}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
