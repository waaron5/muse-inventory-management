import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import Link from "next/link";
import Image from "next/image";
import { InventoryDetailActions } from "./InventoryDetailActions";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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
        { label: "Inventory", href: "/inventory" },
        { label: item.title },
      ]} />

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
                requestedById: r.requestedBy.id,
                requestedByName: r.requestedBy.name,
                eventName: r.event.eventName,
                eventStartDate: r.event.startDate.toISOString(),
                eventEndDate: r.event.endDate.toISOString(),
                notes: r.notes ?? undefined,
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
    </>
  );
}
