import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEventStatus } from "@/lib/availability";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";

type DashEvent = {
  id: string;
  companyName: string;
  eventName: string;
  startDate: Date;
  endDate: Date;
  inventoryReservations: { id: string }[];
  giftReservations: { id: string }[];
};

type MyReservation = {
  id: string;
  quantity: number;
  inventoryItem: { title: string };
  event: { eventName: string; endDate: Date };
};

type PendingApproval = {
  id: string;
  quantity: number;
  inventoryItem?: { id: string; title: string };
  giftItem?: { id: string; title: string };
  event: { eventName: string };
  requestedBy: { name: string };
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session!.user.id;

  const allEvents: DashEvent[] = await prisma.event.findMany({
    orderBy: { startDate: "asc" },
    include: {
      inventoryReservations: { where: { status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } },
      giftReservations: { where: { status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } },
    },
  });

  const myApprovedInvReservations: MyReservation[] = (await prisma.inventoryReservation.findMany({
    where: { requestedById: userId, status: "APPROVED" },
    include: {
      inventoryItem: { select: { title: true } },
      event: { select: { eventName: true, endDate: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  })) as unknown as MyReservation[];

  const [
    activeInventoryCount,
    activeGiftCount,
    pendingInvReservations,
    pendingGiftReservations,
  ] = await Promise.all([
    prisma.inventoryItem.count({ where: { status: "ACTIVE" } }),
    prisma.giftItem.count({ where: { status: "ACTIVE" } }),
    prisma.inventoryReservation.count({ where: { status: "PENDING" } }),
    prisma.giftReservation.count({ where: { status: "PENDING" } }),
  ]);

  const upcomingEvents = allEvents
    .filter((e) => getEventStatus(e.startDate, e.endDate) === "future")
    .slice(0, 5);

  const currentEvents = allEvents.filter(
    (e) => getEventStatus(e.startDate, e.endDate) === "current"
  );

  let pendingInvList: PendingApproval[] = [];
  let pendingGiftList: PendingApproval[] = [];
  if (isAdmin) {
    [pendingInvList, pendingGiftList] = await Promise.all([
      prisma.inventoryReservation.findMany({
        where: { status: "PENDING" },
        include: {
          inventoryItem: { select: { id: true, title: true } },
          event: { select: { eventName: true } },
          requestedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 8,
      }) as unknown as PendingApproval[],
      prisma.giftReservation.findMany({
        where: { status: "PENDING" },
        include: {
          giftItem: { select: { id: true, title: true } },
          event: { select: { eventName: true } },
          requestedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 8,
      }) as unknown as PendingApproval[],
    ]);
  }

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
                  <Link key={r.id} href={`/inventory/${r.inventoryItem?.id}`} className="event-row">
                    <div className="event-info">
                      <span className="event-name">{r.inventoryItem?.title}</span>
                      <span className="event-company">{r.event.eventName} · {r.requestedBy.name}</span>
                    </div>
                    <span className="badge-inv">Inventory</span>
                  </Link>
                ))}
                {pendingGiftList.map((r) => (
                  <Link key={r.id} href={`/gifting/${r.giftItem?.id}`} className="event-row">
                    <div className="event-info">
                      <span className="event-name">{r.giftItem?.title}</span>
                      <span className="event-company">{r.event.eventName} · {r.requestedBy.name}</span>
                    </div>
                    <span className="badge-gift">Gift</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <style>{`
        .dashboard-wrap { max-width: 1100px; }
        .dash-title { font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 4px; }
        .dash-subtitle { font-size: 14px; color: #6b7280; margin: 0 0 28px; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
        .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .dash-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 20px;
        }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .card-title { font-size: 15px; font-weight: 600; color: #111827; margin: 0; }
        .card-link { font-size: 13px; color: #6b7280; text-decoration: none; }
        .card-link:hover { color: #111827; }
        .empty { font-size: 13px; color: #9ca3af; margin: 0; }
        .event-list { display: flex; flex-direction: column; gap: 1px; }
        .event-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #f3f4f6;
          text-decoration: none;
          color: inherit;
        }
        .event-row:last-child { border-bottom: none; }
        .event-row:hover .event-name { color: #111827; text-decoration: underline; }
        .event-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .event-name { font-size: 13px; font-weight: 500; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .event-company { font-size: 12px; color: #9ca3af; }
        .event-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
        .event-date { font-size: 12px; color: #6b7280; white-space: nowrap; flex-shrink: 0; }
        .event-resvs { font-size: 11px; color: #9ca3af; }
        .badge-pill {
          font-size: 11px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #374151;
        }
        .badge-warn { background: #fef3c7; color: #92400e; }
        .badge-inv { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #dbeafe; color: #1e40af; flex-shrink: 0; }
        .badge-gift { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #fce7f3; color: #9d174d; flex-shrink: 0; }
        @media (max-width: 900px) {
          .stat-grid { grid-template-columns: repeat(2, 1fr); }
          .dash-grid { grid-template-columns: 1fr; }
        }
      `}</style>
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
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: color,
          borderRadius: 10,
          padding: "20px 20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          transition: "opacity 0.12s",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{label}</span>
      </div>
    </Link>
  );
}
