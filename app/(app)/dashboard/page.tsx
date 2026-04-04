import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEventStatus } from "@/lib/availability";
import { StatusBadge } from "@/components/StatusBadge";

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDateRange(startDate: Date, endDate: Date) {
  return `${startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function formatDueDate(endDate: Date) {
  return `Due ${endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session!.user.id;
  const todayStart = getTodayStart();
  const firstName =
    session?.user.name?.trim().split(/\s+/)[0] ??
    session?.user.email?.split("@")[0] ??
    "there";

  const [
    allEvents,
    activeInventoryCount,
    myPendingInvReservations,
    myApprovedInvReservations,
    myReturnDueReservations,
    adminPendingInvReservations,
    adminAwaitingReturnReservations,
    myReservationUpdateCount,
  ] = await Promise.all([
    prisma.event.findMany({
      orderBy: { startDate: "asc" },
      include: {
        inventoryReservations: {
          where: { status: { in: ["PENDING", "APPROVED"] } },
          select: { id: true },
        },
        giftReservations: {
          where: { status: { in: ["PENDING", "APPROVED"] } },
          select: { id: true },
        },
      },
    }),
    prisma.inventoryItem.count({ where: { status: "ACTIVE" } }),
    isAdmin
      ? Promise.resolve([])
      : prisma.inventoryReservation.findMany({
          where: { requestedById: userId, status: "PENDING" },
          include: {
            inventoryItem: { select: { title: true } },
            event: { select: { eventName: true, endDate: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
    isAdmin
      ? Promise.resolve([])
      : prisma.inventoryReservation.findMany({
          where: { requestedById: userId, status: "APPROVED" },
          include: {
            inventoryItem: { select: { title: true } },
            event: { select: { eventName: true, endDate: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
        }),
    isAdmin
      ? Promise.resolve([])
      : prisma.inventoryReservation.findMany({
          where: {
            requestedById: userId,
            status: "APPROVED",
            event: { endDate: { lt: todayStart } },
          },
          include: {
            inventoryItem: { select: { title: true } },
            event: { select: { eventName: true, endDate: true } },
          },
          orderBy: { event: { endDate: "asc" } },
          take: 5,
        }),
    isAdmin
      ? prisma.inventoryReservation.findMany({
          where: { status: "PENDING" },
          include: {
            inventoryItem: { select: { title: true } },
            event: { select: { id: true, eventName: true, endDate: true } },
            requestedBy: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 6,
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.inventoryReservation.findMany({
          where: {
            status: "APPROVED",
            event: { endDate: { lt: todayStart } },
          },
          include: {
            inventoryItem: { select: { title: true } },
            event: { select: { id: true, eventName: true, endDate: true } },
            requestedBy: { select: { name: true } },
          },
          orderBy: { event: { endDate: "asc" } },
          take: 6,
        })
      : Promise.resolve([]),
    isAdmin
      ? Promise.resolve(0)
      : prisma.inventoryReservation.count({
          where: {
            requestedById: userId,
            status: { in: ["APPROVED", "REJECTED", "CANCELED", "COMPLETED"] },
            lastModifiedById: { not: userId },
          },
        }),
  ]);

  const upcomingEvents = allEvents
    .filter((event) => getEventStatus(event.startDate, event.endDate) === "future")
    .slice(0, 5);
  const currentEvents = allEvents.filter(
    (event) => getEventStatus(event.startDate, event.endDate) === "current"
  );

  const reservationUpdateHref =
    myApprovedInvReservations.length > 0
      ? "/reservations?tab=approved"
      : "/reservations?tab=history";

  return (
    <>
      <div className="dashboard-wrap">
        <h1 className="dash-title">Dashboard</h1>
        <p className="dash-subtitle">Welcome back, {firstName}</p>
        {!isAdmin && myReservationUpdateCount > 0 && (
          <div className="dash-notice-row">
            <Link href={reservationUpdateHref} className="dash-notice-link">
              <span className="badge-pill badge-info">
                {myReservationUpdateCount}
              </span>
              <span>
                {myReservationUpdateCount === 1
                  ? "Reservation update to review"
                  : "Reservation updates to review"}
              </span>
            </Link>
          </div>
        )}

        <div className="stat-grid">
          {isAdmin ? (
            <>
              <StatCard
                label="Pending Approvals"
                value={adminPendingInvReservations.length}
                href="/reservations"
                color={
                  adminPendingInvReservations.length > 0 ? "#fef3c7" : "#f3f4f6"
                }
              />
              <StatCard
                label="Items Awaiting Return"
                value={adminAwaitingReturnReservations.length}
                href="/reservations?tab=approved"
                color={
                  adminAwaitingReturnReservations.length > 0
                    ? "#fee2e2"
                    : "#f3f4f6"
                }
              />
              <StatCard
                label="Active Inventory Items"
                value={activeInventoryCount}
                href="/inventory"
                color="#dbeafe"
              />
              <StatCard
                label="Active Events"
                value={currentEvents.length}
                href="/events"
                color="#d1fae5"
              />
            </>
          ) : (
            <>
              <StatCard
                label="Active Events"
                value={currentEvents.length}
                href="/events"
                color="#d1fae5"
              />
              <StatCard
                label="My Pending Reservations"
                value={myPendingInvReservations.length}
                href="/reservations"
                color={
                  myPendingInvReservations.length > 0 ? "#fef3c7" : "#f3f4f6"
                }
              />
              <StatCard
                label="My Approved Reservations"
                value={myApprovedInvReservations.length}
                href="/reservations?tab=approved"
                color={
                  myApprovedInvReservations.length > 0 ? "#dcfce7" : "#f3f4f6"
                }
              />
              <StatCard
                label="Items To Return"
                value={myReturnDueReservations.length}
                href="/reservations?tab=approved"
                color={
                  myReturnDueReservations.length > 0 ? "#fee2e2" : "#f3f4f6"
                }
              />
            </>
          )}
        </div>

        <div className="dash-grid">
          {!isAdmin && (
            <>
              <section className="dash-card">
                <div className="card-header">
                  <h2 className="card-title">My Pending Reservations</h2>
                  <Link href="/reservations" className="card-link">
                    Open reservations →
                  </Link>
                </div>
                {myPendingInvReservations.length === 0 ? (
                  <p className="empty">No pending reservation requests.</p>
                ) : (
                  <div className="event-list">
                    {myPendingInvReservations.map((reservation) => (
                      <Link
                        key={reservation.id}
                        href="/reservations"
                        className="event-row"
                      >
                        <div className="event-info">
                          <span className="event-name">
                            {reservation.inventoryItem.title}
                          </span>
                          <span className="event-company">
                            {reservation.event.eventName}
                          </span>
                        </div>
                        <span className="badge-pill badge-warn">
                          Awaiting approval
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="dash-card">
                <div className="card-header">
                  <h2 className="card-title">My Approved Reservations</h2>
                  <div className="dash-card-meta">
                    {myReservationUpdateCount > 0 && (
                      <span className="badge-pill badge-info">Updated</span>
                    )}
                    <Link href="/reservations?tab=approved" className="card-link">
                      Open reservations →
                    </Link>
                  </div>
                </div>
                {myApprovedInvReservations.length === 0 ? (
                  <p className="empty">No approved reservations right now.</p>
                ) : (
                  <div className="event-list">
                    {myApprovedInvReservations.map((reservation) => (
                      <Link
                        key={reservation.id}
                        href="/reservations?tab=approved"
                        className="event-row"
                      >
                        <div className="event-info">
                          <span className="event-name">
                            {reservation.inventoryItem.title}
                          </span>
                          <span className="event-company">
                            {reservation.event.eventName}
                          </span>
                        </div>
                        <span className="event-date">
                          {formatDueDate(reservation.event.endDate)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="dash-card">
                <div className="card-header">
                  <h2 className="card-title">Items To Return</h2>
                  <div className="dash-card-meta">
                    {myReturnDueReservations.length > 0 && (
                      <span className="badge-pill badge-warn">
                        Action needed
                      </span>
                    )}
                    <Link href="/reservations?tab=approved" className="card-link">
                      Open reservations →
                    </Link>
                  </div>
                </div>
                {myReturnDueReservations.length === 0 ? (
                  <p className="empty">Nothing is awaiting return right now.</p>
                ) : (
                  <div className="event-list">
                    {myReturnDueReservations.map((reservation) => (
                      <Link
                        key={reservation.id}
                        href="/reservations?tab=approved"
                        className="event-row"
                      >
                        <div className="event-info">
                          <span className="event-name">
                            {reservation.inventoryItem.title}
                          </span>
                          <span className="event-company">
                            {reservation.event.eventName}
                          </span>
                        </div>
                        <span className="event-date">
                          {formatDueDate(reservation.event.endDate)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {isAdmin && (
            <>
              <section className="dash-card">
                <div className="card-header">
                  <h2 className="card-title">Pending Approvals</h2>
                  <div className="dash-card-meta">
                    {adminPendingInvReservations.length > 0 && (
                      <span className="badge-pill badge-warn">
                        {adminPendingInvReservations.length}
                      </span>
                    )}
                    <Link href="/reservations" className="card-link">
                      Open reservations →
                    </Link>
                  </div>
                </div>
                {adminPendingInvReservations.length === 0 ? (
                  <p className="empty">No reservation approvals are waiting.</p>
                ) : (
                  <div className="event-list">
                    {adminPendingInvReservations.map((reservation) => (
                      <Link
                        key={reservation.id}
                        href="/reservations"
                        className="event-row"
                      >
                        <div className="event-info">
                          <span className="event-name">
                            {reservation.inventoryItem.title}
                          </span>
                          <span className="event-company">
                            {reservation.event.eventName} ·{" "}
                            {reservation.requestedBy.name}
                          </span>
                        </div>
                        <span className="badge-pill badge-warn">
                          Review
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="dash-card">
                <div className="card-header">
                  <h2 className="card-title">Items Awaiting Return</h2>
                  <div className="dash-card-meta">
                    {adminAwaitingReturnReservations.length > 0 && (
                      <span className="badge-pill badge-warn">
                        {adminAwaitingReturnReservations.length}
                      </span>
                    )}
                    <Link href="/reservations?tab=approved" className="card-link">
                      Open reservations →
                    </Link>
                  </div>
                </div>
                {adminAwaitingReturnReservations.length === 0 ? (
                  <p className="empty">No approved reservations are awaiting return.</p>
                ) : (
                  <div className="event-list">
                    {adminAwaitingReturnReservations.map((reservation) => (
                      <Link
                        key={reservation.id}
                        href={`/events/${reservation.event.id}`}
                        className="event-row"
                      >
                        <div className="event-info">
                          <span className="event-name">
                            {reservation.inventoryItem.title}
                          </span>
                          <span className="event-company">
                            {reservation.event.eventName} ·{" "}
                            {reservation.requestedBy.name}
                          </span>
                        </div>
                        <span className="event-date">
                          {formatDueDate(reservation.event.endDate)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          <section className="dash-card">
            <div className="card-header">
              <h2 className="card-title">Upcoming Events</h2>
              <Link href="/events" className="card-link">
                View all →
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="empty">No upcoming events.</p>
            ) : (
              <div className="event-list">
                {upcomingEvents.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`} className="event-row">
                    <div className="event-info">
                      <span className="event-name">{event.eventName}</span>
                      <span className="event-company">{event.companyName}</span>
                    </div>
                    <div className="event-meta">
                      <span className="event-date">
                        {formatDateRange(event.startDate, event.endDate)}
                      </span>
                      <span className="event-resvs">
                        {event.inventoryReservations.length +
                          event.giftReservations.length}{" "}
                        reservations
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {currentEvents.length > 0 && (
            <section className="dash-card">
              <div className="card-header">
                <h2 className="card-title">Events Happening Now</h2>
                <StatusBadge variant="current" />
              </div>
              <div className="event-list">
                {currentEvents.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`} className="event-row">
                    <div className="event-info">
                      <span className="event-name">{event.eventName}</span>
                      <span className="event-company">{event.companyName}</span>
                    </div>
                    <span className="event-date">
                      Ends{" "}
                      {event.endDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  href,
  color,
}: {
  label: string;
  value: number;
  href: string;
  color: string;
}) {
  return (
    <Link href={href} className="stat-card" style={{ background: color }}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </Link>
  );
}
