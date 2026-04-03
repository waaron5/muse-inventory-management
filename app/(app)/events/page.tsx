import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { FilterDropdown } from "@/components/FilterDropdown";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import { getEventStatus } from "@/lib/availability";
import Link from "next/link";
import { EventRowActions } from "./EventRowActions";

const STATUS_FILTERS = [
  { label: "Past", value: "past" },
  { label: "Current", value: "current" },
  { label: "Upcoming", value: "future" },
];

const PAGE_SIZE = 20;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const params = await searchParams;
  const query = params.q ?? "";
  const filterStatus = params.filter ?? "";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

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
  const allEnriched = events
    .map((e) => ({
      ...e,
      computedStatus: getEventStatus(e.startDate, e.endDate),
    }))
    .filter((e) => !filterStatus || e.computedStatus === filterStatus);

  const totalCount = allEnriched.length;
  const enriched = allEnriched.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
        <span className="item-count">{totalCount} events</span>
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

      <Pagination total={totalCount} pageSize={PAGE_SIZE} currentPage={currentPage} />
    </>
  );
}
