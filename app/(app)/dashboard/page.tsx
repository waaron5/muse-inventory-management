import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEventStatus } from "@/lib/availability";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session!.user.id;
  const now = new Date();

  const [
    allEvents,
    myApprovedInvReservations,
    activeInventoryCount,
    activeGiftCount,
    pendingInvReservations,
    pendingGiftReservations,
    pendingInvList,
    pendingGiftList,
    allAwaitingReturn,
  ] = await Promise.all([
    prisma.event.findMany({
      orderBy: { startDate: "asc" },
      include: {
        inventoryReservations: { where: { status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } },
        giftReservations: { where: { status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } },
      },
    }),
    prisma.inventoryReservation.findMany({
      where: { requestedById: userId, status: "APPROVED" },
      include: {
        inventoryItem: { select: { title: true } },
        event: { select: { eventName: true, endDate: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.inventoryItem.count({ where: { status: "ACTIVE" } }),
    prisma.giftItem.count({ where: { status: "ACTIVE" } }),
    prisma.inventoryReservation.count({ where: { status: "PENDING" } }),
    prisma.giftReservation.count({ where: { status: "PENDING" } }),
    isAdmin
      ? prisma.inventoryReservation.findMany({
          where: { status: "PENDING" },
          include: {
            inventoryItem: { select: { id: true, title: true } },
            event: { select: { eventName: true } },
            requestedBy: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.giftReservation.findMany({
          where: { status: "PENDING" },
          include: {
            giftItem: { select: { id: true, title: true } },
            event: { select: { eventName: true } },
            requestedBy: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.inventoryReservation.findMany({
          where: { status: "APPROVED" },
          include: {
            inventoryItem: { select: { id: true, title: true } },
            event: { select: { eventName: true, endDate: true } },
            requestedBy: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  const upcomingEvents = allEvents
    .filter((e) => getEventStatus(e.startDate, e.endDate) === "future")
    .slice(0, 5);

  const currentEvents = allEvents.filter(
    (e) => getEventStatus(e.startDate, e.endDate) === "current"
  );

  return (
    <>
      <div className="dashboard-wrap">
        <h1 className="dash-title">Dashboard</h1>
        <p className="dash-subtitle">
          Welcome back, {session?.user.name ?? session?.user.email}
        </p>

        {/* Stat Cards */}
        <div className="stat-grid">
          <StatCard
            label="Active Inventory Items"
            value={activeInventoryCount}
            href="/inventory"
            color="#dbeafe"
          />
          <StatCard
            label="Active Gift Items"
            value={activeGiftCount}
            href="/gifting"
            color="#fce7f3"
          />
          <StatCard
            label="Pending Approvals"
            value={pendingInvReservations + pendingGiftReservations}
            href="#pending"
            color={pendingInvReservations + pendingGiftReservations > 0 ? "#fef3c7" : "#f3f4f6"}
          />
          <StatCard
            label="Active Events"
            value={currentEvents.length}
            href="/events"
            color="#d1fae5"
          />
        </div>

        <div className="dash-grid">
          {/* Upcoming Events */}
          <section className="dash-card">
            <div className="card-header">
              <h2 className="card-title">Upcoming Events</h2>
              <Link href="/events" className="card-link">View all →</Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="empty">No upcoming events.</p>
            ) : (
              <div className="event-list">
                {upcomingEvents.map((ev) => (
                  <Link key={ev.id} href={`/events/${ev.id}`} className="event-row">
                    <div className="event-info">
                      <span className="event-name">{ev.eventName}</span>
                      <span className="event-company">{ev.companyName}</span>
                    </div>
                    <div className="event-meta">
                      <span className="event-date">
                        {ev.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" – "}
                        {ev.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="event-resvs">
                        {ev.inventoryReservations.length + ev.giftReservations.length} reservations
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Currently Active Events */}
          {currentEvents.length > 0 && (
            <section className="dash-card">
              <div className="card-header">
                <h2 className="card-title">Events Happening Now</h2>
                <StatusBadge variant="current" />
              </div>
              <div className="event-list">
                {currentEvents.map((ev) => (
                  <Link key={ev.id} href={`/events/${ev.id}`} className="event-row">
                    <div className="event-info">
                      <span className="event-name">{ev.eventName}</span>
                      <span className="event-company">{ev.companyName}</span>
                    </div>
                    <span className="event-date">
                      Ends {ev.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* My Approved Reservations Awaiting Return */}
          {myApprovedInvReservations.length > 0 && (
            <section className="dash-card">
              <div className="card-header">
                <h2 className="card-title">My Items Out</h2>
                <span className="badge-pill">Pending Return</span>
              </div>
              <div className="event-list">
                {myApprovedInvReservations.map((r) => (
                  <div key={r.id} className="event-row">
                    <div className="event-info">
                      <span className="event-name">{r.inventoryItem.title}</span>
                      <span className="event-company">{r.event.eventName}</span>
                    </div>
                    <span className="event-date">
                      Due {r.event.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Admin: Pending Approvals */}
          {isAdmin && (pendingInvList.length > 0 || pendingGiftList.length > 0) && (
            <section className="dash-card" id="pending">
              <div className="card-header">
                <h2 className="card-title">Pending Approvals</h2>
                <span className="badge-pill badge-warn">{pendingInvList.length + pendingGiftList.length}</span>
              </div>
              <div className="event-list">
                {pendingInvList.map((r) => (
                  <Link key={r.id} href={`/inventory/${r.inventoryItem.id}`} className="event-row">
                    <div className="event-info">
                      <span className="event-name">{r.inventoryItem.title}</span>
                      <span className="event-company">{r.event.eventName} · {r.requestedBy.name}</span>
                    </div>
                    <span className="badge-inv">Inventory</span>
                  </Link>
                ))}
                {pendingGiftList.map((r) => (
                  <Link key={r.id} href={`/gifting/${r.giftItem.id}`} className="event-row">
                    <div className="event-info">
                      <span className="event-name">{r.giftItem.title}</span>
                      <span className="event-company">{r.event.eventName} · {r.requestedBy.name}</span>
                    </div>
                    <span className="badge-gift">Gift</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Admin: All Items Awaiting Return */}
          {isAdmin && allAwaitingReturn.length > 0 && (
            <section className="dash-card">
              <div className="card-header">
                <h2 className="card-title">Items Awaiting Return</h2>
                <span className="badge-pill badge-warn">{allAwaitingReturn.length}</span>
              </div>
              <div className="event-list">
                {allAwaitingReturn.map((r) => (
                  <Link key={r.id} href={`/inventory/${r.inventoryItem.id}`} className="event-row">
                    <div className="event-info">
                      <span className="event-name">{r.inventoryItem.title}</span>
                      <span className="event-company">{r.event.eventName} · {r.requestedBy.name} · Qty: {r.quantity}</span>
                    </div>
                    <span className="event-date">
                      Due {r.event.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
