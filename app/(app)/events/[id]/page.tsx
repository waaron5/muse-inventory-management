import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getEventStatus } from "@/lib/availability";
import Link from "next/link";

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
      <div className="back-link-wrap">
        <Link href="/events" className="back-link">
          ← Back to Events
        </Link>
      </div>

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

      <div className="detail-grid">
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

      <style>{`
        .back-link-wrap {
          margin-bottom: 16px;
        }
        .back-link {
          font-size: 14px;
          color: #6b7280;
          text-decoration: none;
        }
        .back-link:hover {
          color: #111827;
        }
        .detail-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .detail-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 24px;
        }
        .detail-fields {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .detail-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 14px;
        }
        .detail-row-block {
          flex-direction: column;
          gap: 4px;
        }
        .detail-label {
          font-weight: 500;
          color: #6b7280;
          min-width: 110px;
          flex-shrink: 0;
        }
        .detail-notes {
          margin: 0;
          color: #374151;
          font-size: 14px;
        }
        .reservations-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 20px;
        }
        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 14px;
        }
        .empty-hint {
          font-size: 13px;
          color: #9ca3af;
          margin: 0;
        }
        .res-table {
          width: 100%;
          border-collapse: collapse;
        }
        .res-table th {
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 500;
          color: #6b7280;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        .res-table td {
          padding: 10px 12px;
          font-size: 13px;
          border-bottom: 1px solid #f3f4f6;
        }
        .res-table tr:last-child td {
          border-bottom: none;
        }
        .item-link {
          color: #111827;
          text-decoration: none;
          font-weight: 500;
        }
        .item-link:hover {
          color: #00b4d8;
        }
        .text-muted {
          color: #6b7280;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.12s;
          white-space: nowrap;
        }
        .btn-outline {
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
        }
        .btn-outline:hover {
          background: #f3f4f6;
        }
      `}</style>
    </>
  );
}
