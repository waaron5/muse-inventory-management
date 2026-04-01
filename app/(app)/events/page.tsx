import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { FilterDropdown } from "@/components/FilterDropdown";
import { StatusBadge } from "@/components/StatusBadge";
import { getEventStatus } from "@/lib/availability";
import Link from "next/link";
import { EventRowActions } from "./EventRowActions";

const STATUS_FILTERS = [
  { label: "Past", value: "past" },
  { label: "Current", value: "current" },
  { label: "Upcoming", value: "future" },
];

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const params = await searchParams;
  const query = params.q ?? "";
  const filterStatus = params.filter ?? "";

  const events = await prisma.event.findMany({
    where: {
      ...(query
        ? {
            OR: [
              { companyName: { contains: query, mode: "insensitive" } },
              { eventName: { contains: query, mode: "insensitive" } },
              { location: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { startDate: "asc" },
    include: {
      _count: {
        select: {
          inventoryReservations: true,
          giftReservations: true,
        },
      },
    },
  });

  // Enrich with computed status and apply status filter
  const enriched = events
    .map((e) => ({
      ...e,
      computedStatus: getEventStatus(e.startDate, e.endDate),
    }))
    .filter((e) => !filterStatus || e.computedStatus === filterStatus);

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Manage events and their inventory reservations"
        action={
          isAdmin ? (
            <Link href="/events/new" className="btn btn-dark">
              + Create Event
            </Link>
          ) : undefined
        }
      />

      <div className="table-toolbar">
        <SearchBar placeholder="Search events, companies, locations..." />
        <FilterDropdown
          options={STATUS_FILTERS}
          defaultLabel="All Events"
          paramName="filter"
        />
        <span className="item-count">{enriched.length} events</span>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Event Name</th>
              <th>Date Range</th>
              <th>Location</th>
              <th>Status</th>
              <th>Reservations</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {enriched.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No events found.
                </td>
              </tr>
            )}
            {enriched.map((event) => (
              <tr
                key={event.id}
                className={`table-row ${event.computedStatus === "past" ? "row-past" : ""}`}
              >
                <td>
                  <span className="font-medium">{event.companyName}</span>
                </td>
                <td>
                  <Link href={`/events/${event.id}`} className="event-title-link">
                    {event.eventName}
                  </Link>
                </td>
                <td>
                  <span className="text-muted date-range">
                    {event.startDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {" – "}
                    {event.endDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </td>
                <td>
                  <span className="text-muted">{event.location}</span>
                </td>
                <td>
                  <StatusBadge variant={event.computedStatus} />
                </td>
                <td>
                  <span className="text-muted">
                    {event._count.inventoryReservations +
                      event._count.giftReservations}{" "}
                    total
                  </span>
                </td>
                <td>
                  <EventRowActions
                    event={{ id: event.id, eventName: event.eventName }}
                    isAdmin={isAdmin}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .table-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }
        .item-count {
          font-size: 13px;
          color: #6b7280;
          margin-left: 4px;
        }
        .table-container {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table thead tr {
          border-bottom: 1px solid #e5e7eb;
        }
        .data-table th {
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          text-align: left;
        }
        .data-table td {
          padding: 14px 16px;
          font-size: 14px;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: middle;
        }
        .table-row:last-child td {
          border-bottom: none;
        }
        .table-row:hover td {
          background: #f9fafb;
        }
        .row-past td {
          opacity: 0.55;
        }
        .font-medium {
          font-weight: 500;
          color: #111827;
        }
        .event-title-link {
          font-weight: 500;
          color: #111827;
          text-decoration: none;
        }
        .event-title-link:hover {
          color: #00b4d8;
        }
        .text-muted {
          color: #6b7280;
        }
        .date-range {
          white-space: nowrap;
        }
        .empty-row {
          text-align: center;
          color: #9ca3af;
          padding: 48px 16px;
          font-size: 14px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          border: none;
          border-radius: 8px;
          padding: 9px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.12s;
          white-space: nowrap;
        }
        .btn-dark {
          background: #111827;
          color: white;
        }
        .btn-dark:hover {
          background: #1f2937;
        }
      `}</style>
    </>
  );
}
