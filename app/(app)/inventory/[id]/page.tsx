import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import Link from "next/link";
import Image from "next/image";
import { InventoryDetailActions } from "./InventoryDetailActions";

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";

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
          requestedBy: { select: { name: true, email: true } },
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

  return (
    <>
      <div className="back-link-wrap">
        <Link href="/inventory" className="back-link">
          ← Back to Inventory
        </Link>
      </div>

      <PageHeader
        title={item.title}
        subtitle={item.description ?? undefined}
        action={
          isAdmin ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Link href={`/inventory/${id}/edit`} className="btn btn-outline">
                Edit
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-card">
            <div className="detail-image-section">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  width={120}
                  height={120}
                  style={{ objectFit: "cover", borderRadius: 8 }}
                />
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
              <div className="detail-row">
                <span className="detail-label">Currently Reserved</span>
                <span>
                  {item.reservations
                    .filter((r) => r.status === "APPROVED")
                    .reduce((s, r) => s + r.quantity, 0)}
                </span>
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

          {item.status === "ACTIVE" && (
            <InventoryDetailActions
              itemId={item.id}
              itemTitle={item.title}
              isAdmin={isAdmin}
              userId={session!.user.id}
              activeReservations={activeReservations.map((r) => ({
                id: r.id,
                quantity: r.quantity,
                status: r.status as string,
                requestedById: r.requestedBy.email,
                requestedByName: r.requestedBy.name,
                eventName: r.event.eventName,
                eventStartDate: r.event.startDate.toISOString(),
                eventEndDate: r.event.endDate.toISOString(),
                notes: r.notes ?? undefined,
              }))}
            />
          )}
        </div>

        {/* Reservation history */}
        <div className="detail-side">
          <h3 className="section-title">Reservations</h3>
          {item.reservations.length === 0 ? (
            <p className="empty-hint">No reservations yet.</p>
          ) : (
            <div className="reservation-list">
              {item.reservations.map((r) => (
                <div key={r.id} className="reservation-card">
                  <div className="res-top">
                    <span className="res-event">{r.event.eventName}</span>
                    <StatusBadge
                      variant={r.status.toLowerCase() as Parameters<typeof StatusBadge>[0]["variant"]}
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
          transition: color 0.12s;
        }
        .back-link:hover {
          color: #111827;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 24px;
          align-items: start;
        }
        .detail-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 24px;
          display: flex;
          gap: 24px;
          margin-bottom: 20px;
        }
        .detail-image-section {
          flex-shrink: 0;
        }
        .image-placeholder-lg {
          width: 120px;
          height: 120px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .detail-fields {
          flex: 1;
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
          min-width: 130px;
          flex-shrink: 0;
        }
        .detail-notes {
          margin: 0;
          color: #374151;
          font-size: 14px;
        }
        .detail-side {
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
        .reservation-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .reservation-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .res-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .res-event {
          font-size: 13px;
          font-weight: 500;
          color: #111827;
        }
        .res-meta {
          font-size: 12px;
          color: #6b7280;
        }
        .res-notes {
          font-size: 12px;
          color: #6b7280;
          margin: 4px 0 0;
        }
        .audit-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .audit-row {
          border-left: 2px solid #e5e7eb;
          padding-left: 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .audit-action {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .audit-meta {
          font-size: 11px;
          color: #9ca3af;
        }
        .audit-summary {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
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
