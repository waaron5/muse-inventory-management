import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import Link from "next/link";
import { GiftDetailActions } from "./GiftDetailActions";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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
  const approvedReservations = item.reservations.filter(
    (r) => r.status === "APPROVED"
  );

  // Fetch current/future events for reservation dropdown
  const availableEvents = await prisma.event.findMany({
    where: { endDate: { gte: new Date() } },
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
      <Breadcrumbs items={[
        { label: "Gifting", href: "/gifting" },
        { label: item.title },
      ]} />

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
              pendingReservations={pendingReservations.map((r) => ({
                id: r.id,
                quantity: r.quantity,
                requestedByName: r.requestedBy.name,
                eventName: r.event.eventName,
              }))}
              approvedReservations={approvedReservations.map((r) => ({
                id: r.id,
                quantity: r.quantity,
                requestedByName: r.requestedBy.name,
                eventName: r.event.eventName,
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
    </>
  );
}
