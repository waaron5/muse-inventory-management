import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import Link from "next/link";
import { GiftDetailActions } from "./GiftDetailActions";

export default async function GiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";

  const item = await prisma.giftItem.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      reservations: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          event: { select: { companyName: true, eventName: true, startDate: true, endDate: true } },
          requestedBy: { select: { name: true } },
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

  const pendingReservations = item.reservations.filter((r) => r.status === "PENDING");

  return (
    <>
      <div className="back-link-wrap">
        <Link href="/gifting" className="back-link">← Back to Gifting</Link>
      </div>

      <PageHeader
        title={item.title}
        subtitle={item.description ?? undefined}
        action={
          isAdmin ? (
            <Link href={`/gifting/${id}/edit`} className="btn btn-outline">Edit</Link>
          ) : undefined
        }
      />

      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-card">
            <div className="detail-fields">
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <StatusBadge variant={item.status === "ACTIVE" ? "active" : "consumed"} />
              </div>
              <div className="detail-row">
                <span className="detail-label">Total Quantity</span>
                <span className={item.status === "CONSUMED" ? "strikethrough" : ""}>{item.quantity}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Currently Allocated</span>
                <span>
                  {item.reservations
                    .filter((r) => r.status === "APPROVED")
                    .reduce((s, r) => s + r.quantity, 0)}
                </span>
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
            <GiftDetailActions
              itemId={item.id}
              itemTitle={item.title}
              isAdmin={isAdmin}
              userId={session!.user.id}
              pendingReservations={pendingReservations.map((r) => ({
                id: r.id,
                quantity: r.quantity,
                requestedByName: r.requestedBy.name,
                eventName: r.event.eventName,
              }))}
            />
          )}
        </div>

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
                    {r.event.companyName} · Qty: {r.quantity} · By: {r.requestedBy.name}
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="section-title" style={{ marginTop: 28 }}>Change History</h3>
          {auditLogs.length === 0 ? (
            <p className="empty-hint">No history recorded.</p>
          ) : (
            <div className="audit-list">
              {auditLogs.map((log) => (
                <div key={log.id} className="audit-row">
                  <span className="audit-action">{log.actionType.replace("_", " ")}</span>
                  <span className="audit-meta">{log.performedBy.name} · {log.timestamp.toLocaleDateString()}</span>
                  <p className="audit-summary">{log.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .back-link-wrap { margin-bottom: 16px; }
        .back-link { font-size: 14px; color: #6b7280; text-decoration: none; }
        .back-link:hover { color: #111827; }
        .detail-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }
        .detail-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 24px;
          margin-bottom: 20px;
        }
        .detail-fields { display: flex; flex-direction: column; gap: 12px; }
        .detail-row { display: flex; align-items: baseline; gap: 8px; font-size: 14px; }
        .detail-row-block { flex-direction: column; gap: 4px; }
        .detail-label { font-weight: 500; color: #6b7280; min-width: 130px; flex-shrink: 0; }
        .detail-notes { margin: 0; color: #374151; font-size: 14px; }
        .strikethrough { text-decoration: line-through; color: #9ca3af; }
        .detail-side {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 20px;
        }
        .section-title { font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 14px; }
        .empty-hint { font-size: 13px; color: #9ca3af; margin: 0; }
        .reservation-list { display: flex; flex-direction: column; gap: 10px; }
        .reservation-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .res-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .res-event { font-size: 13px; font-weight: 500; color: #111827; }
        .res-meta { font-size: 12px; color: #6b7280; }
        .audit-list { display: flex; flex-direction: column; gap: 10px; }
        .audit-row { border-left: 2px solid #e5e7eb; padding-left: 10px; display: flex; flex-direction: column; gap: 2px; }
        .audit-action { font-size: 11px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; }
        .audit-meta { font-size: 11px; color: #9ca3af; }
        .audit-summary { font-size: 12px; color: #6b7280; margin: 0; }
        .btn {
          display: inline-flex;
          align-items: center;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
        }
        .btn-outline {
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
          transition: background 0.12s;
        }
        .btn-outline:hover { background: #f3f4f6; }
      `}</style>
    </>
  );
}
