import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { InventoryReservationRowActions } from "@/components/InventoryReservationRowActions";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getInventoryReservationStatusLabel } from "@/lib/inventory-reservation-ui";
import { getStorageLocationNames } from "@/lib/storage-locations";
import Link from "next/link";
import { InventoryDetailActions } from "./InventoryDetailActions";
import { InventoryHeaderActions } from "./InventoryHeaderActions";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session?.user.id ?? "";

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, email: true } },
      updatedBy: { select: { name: true, email: true } },
      reservations: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          event: { select: { companyName: true, eventName: true, startDate: true, endDate: true } },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!item) notFound();

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "INVENTORY_ITEM", entityId: id },
    orderBy: { timestamp: "desc" },
    take: 20,
    include: { performedBy: { select: { name: true } } },
  });

  const activeReservations = item.reservations.filter((r) =>
    ["PENDING", "APPROVED"].includes(r.status)
  );
  const reservationHistory = item.reservations.filter(
    (reservation) => !["PENDING", "APPROVED"].includes(reservation.status)
  );
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Fetch current/future events for reservation dropdown
  const [availableEvents, returnLocationOptions] = await Promise.all([
    prisma.event.findMany({
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
    }),
    getStorageLocationNames(),
  ]);

  return (
    <>
      <Breadcrumbs items={[
        { label: "Inventory", href: "/inventory" },
        { label: item.title },
      ]} />

      <PageHeader
        title={item.title}
        action={
          isAdmin ? (
            <InventoryHeaderActions
              itemId={id}
              itemTitle={item.title}
            />
          ) : undefined
        }
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
                <StatusBadge variant={item.status === "ACTIVE" ? "active" : "retired"} />
              </div>
              <div className="detail-row">
                <span className="detail-label">Total Quantity</span>
                <span>{item.quantity}</span>
              </div>
              <div className="detail-row detail-row-block">
                <span className="detail-label">Availability</span>
                <p className="detail-notes">
                  Availability is calculated per event. This item can be reserved
                  for multiple events when approved event dates do not overlap.
                </p>
              </div>
              <div className="detail-row">
                <span className="detail-label">Location</span>
                <span>{item.currentLocation ?? "—"}</span>
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
              Active Reservations ({activeReservations.length})
            </h3>
            {activeReservations.length === 0 ? (
              <p className="empty-hint">No active reservations.</p>
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
                          variant={
                            reservation.status.toLowerCase() as Parameters<
                              typeof StatusBadge
                            >[0]["variant"]
                          }
                          label={getInventoryReservationStatusLabel(reservation.status)}
                        />
                      </td>
                      <td className="text-muted">{reservation.requestedBy.name}</td>
                      <td className="res-actions-cell">
                        <InventoryReservationRowActions
                          reservation={{
                            id: reservation.id,
                            status: reservation.status as string,
                            inventoryItemId: item.id,
                            inventoryItemTitle: item.title,
                            requestedById: reservation.requestedBy.id,
                            eventName: reservation.event.eventName,
                            quantity: reservation.quantity,
                          }}
                          isAdmin={isAdmin}
                          userId={userId}
                          returnLocationOptions={returnLocationOptions}
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
          <h3 className="section-title">Reservation History</h3>
          {reservationHistory.length === 0 ? (
            <p className="empty-hint">No past reservation history.</p>
          ) : (
            <div className="reservation-list">
              {reservationHistory.map((r) => (
                <div key={r.id} className="reservation-card">
                  <div className="res-top">
                    <span className="res-event">{r.event.eventName}</span>
                    <StatusBadge
                      variant={r.status.toLowerCase() as Parameters<typeof StatusBadge>[0]["variant"]}
                      label={getInventoryReservationStatusLabel(r.status)}
                    />
                  </div>
                  <div className="res-meta">
                    {r.event.companyName} ·{" "}
                    {r.event.startDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {" – "}
                    {r.event.endDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div className="res-meta">
                    Qty: {r.quantity} · By: {r.requestedBy.name}
                    {r.approvedBy && ` · Approved: ${r.approvedBy.name}`}
                  </div>
                  {r.notes && <p className="res-notes">{r.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Audit log */}
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

          {item.status === "ACTIVE" && (
            <div className="detail-side-action">
              <InventoryDetailActions
                itemId={item.id}
                itemTitle={item.title}
                itemCurrentLocation={item.currentLocation ?? null}
                itemTotalQuantity={item.quantity}
                userId={userId}
                activeReservations={activeReservations.map((r) => ({
                  status: r.status as string,
                  requestedById: r.requestedBy.id,
                }))}
                availableEvents={availableEvents.map((e) => ({
                  id: e.id,
                  eventName: e.eventName,
                  companyName: e.companyName,
                  location: e.location,
                  startDate: e.startDate.toISOString(),
                  endDate: e.endDate.toISOString(),
                }))}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
