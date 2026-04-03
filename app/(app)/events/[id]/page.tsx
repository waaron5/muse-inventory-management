import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getEventStatus } from "@/lib/availability";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      inventoryReservations: {
        orderBy: { createdAt: "desc" },
        include: {
          inventoryItem: { select: { title: true } },
          requestedBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
      },
      giftReservations: {
        orderBy: { createdAt: "desc" },
        include: {
          giftItem: { select: { title: true } },
          requestedBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!event) notFound();

  const status = getEventStatus(event.startDate, event.endDate);

  return (
    <>
      <Breadcrumbs items={[
        { label: "Events", href: "/events" },
        { label: event.eventName },
      ]} />

      <PageHeader
        title={event.eventName}
        subtitle={event.companyName}
        action={
          isAdmin ? (
            <Link href={`/events/${id}/edit`} className="btn btn-outline">
              Edit Event
            </Link>
          ) : undefined
        }
      />

      <div className="detail-grid-stacked">
        <div className="detail-card">
          <div className="detail-fields">
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <StatusBadge variant={status} />
            </div>
            <div className="detail-row">
              <span className="detail-label">Company</span>
              <span>{event.companyName}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Date Range</span>
              <span>
                {event.startDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                {" – "}
                {event.endDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Location</span>
              <span>{event.location}</span>
            </div>
            {event.notes && (
              <div className="detail-row detail-row-block">
                <span className="detail-label">Notes</span>
                <p className="detail-notes">{event.notes}</p>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Created by</span>
              <span>{event.createdBy?.name ?? "—"}</span>
            </div>
          </div>
        </div>

        {/* Inventory Reservations */}
        <div className="reservations-section">
          <h3 className="section-title">
            Inventory Reservations ({event.inventoryReservations.length})
          </h3>
          {event.inventoryReservations.length === 0 ? (
            <p className="empty-hint">None yet.</p>
          ) : (
            <table className="res-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Requested By</th>
                </tr>
              </thead>
              <tbody>
                {event.inventoryReservations.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/inventory/${r.inventoryItemId}`} className="item-link">
                        {r.inventoryItem.title}
                      </Link>
                    </td>
                    <td>{r.quantity}</td>
                    <td>
                      <StatusBadge
                        variant={r.status.toLowerCase() as Parameters<typeof StatusBadge>[0]["variant"]}
                      />
                    </td>
                    <td className="text-muted">{r.requestedBy.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Gift Reservations */}
        <div className="reservations-section">
          <h3 className="section-title">
            Gift Reservations ({event.giftReservations.length})
          </h3>
          {event.giftReservations.length === 0 ? (
            <p className="empty-hint">None yet.</p>
          ) : (
            <table className="res-table">
              <thead>
                <tr>
                  <th>Gift</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Requested By</th>
                </tr>
              </thead>
              <tbody>
                {event.giftReservations.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/gifting/${r.giftItemId}`} className="item-link">
                        {r.giftItem.title}
                      </Link>
                    </td>
                    <td>{r.quantity}</td>
                    <td>
                      <StatusBadge
                        variant={r.status.toLowerCase() as Parameters<typeof StatusBadge>[0]["variant"]}
                      />
                    </td>
                    <td className="text-muted">{r.requestedBy.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
