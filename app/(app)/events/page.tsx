import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { Pagination } from "@/components/Pagination";
import { getEventStatus } from "@/lib/availability";
import Link from "next/link";
import { EventRowActions } from "./EventRowActions";
import { ReserveInventoryForEventButton } from "./ReserveInventoryForEventButton";

const PAGE_SIZE = 20;
const ACTIVE_RESERVATION_STATUSES = ["PENDING", "APPROVED"] as const;
const EVENT_STATUS_ORDER = {
  current: 0,
  future: 1,
  past: 2,
} as const;
const RESERVATION_STATUS_ORDER = {
  PENDING: 0,
  APPROVED: 1,
} as const;

function compareEventRows(
  a: { computedStatus: "past" | "current" | "future"; startDate: Date; endDate: Date; eventName: string },
  b: { computedStatus: "past" | "current" | "future"; startDate: Date; endDate: Date; eventName: string }
) {
  const statusDiff = EVENT_STATUS_ORDER[a.computedStatus] - EVENT_STATUS_ORDER[b.computedStatus];
  if (statusDiff !== 0) return statusDiff;

  if (a.computedStatus === "past" && b.computedStatus === "past") {
    return b.endDate.getTime() - a.endDate.getTime();
  }

  const startDiff = a.startDate.getTime() - b.startDate.getTime();
  if (startDiff !== 0) return startDiff;

  return a.eventName.localeCompare(b.eventName);
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const params = await searchParams;
  const query = params.q ?? "";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const showActions = isAdmin;

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
      inventoryReservations: {
        where: {
          status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        },
        include: {
          inventoryItem: {
            select: {
              title: true,
            },
          },
        },
      },
    },
  });

  const allEnriched = events
    .map((e) => ({
      ...e,
      computedStatus: getEventStatus(e.startDate, e.endDate),
    }))
    .sort(compareEventRows);

  const totalCount = allEnriched.length;
  const enriched = allEnriched.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Manage and reserve inventory for events"
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
        <span className="item-count">{totalCount} events</span>
      </div>

      <div className="table-container">
        <table className="data-table events-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Event Name</th>
              <th>Location</th>
              <th>Date Range</th>
              <th>Inventory</th>
              {showActions && (
                <th className="event-actions-header">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {enriched.length === 0 && (
              <tr>
                <td colSpan={showActions ? 6 : 5} className="empty-row">
                  No events found.
                </td>
              </tr>
            )}
            {enriched.map((event) => (
              (() => {
                const sortedReservations = event.inventoryReservations
                  .slice()
                  .sort((a, b) => {
                    const statusDiff =
                      RESERVATION_STATUS_ORDER[a.status as keyof typeof RESERVATION_STATUS_ORDER] -
                      RESERVATION_STATUS_ORDER[b.status as keyof typeof RESERVATION_STATUS_ORDER];
                    if (statusDiff !== 0) return statusDiff;
                    return b.createdAt.getTime() - a.createdAt.getTime();
                  });

                return (
                  <tr
                    key={event.id}
                    className={`table-row event-row ${event.computedStatus === "past" ? "row-past" : ""}`}
                  >
                    <td>
                      <span className="event-company-name">{event.companyName}</span>
                    </td>
                    <td>
                      <Link href={`/events/${event.id}`} className="event-title-link">
                        {event.eventName}
                      </Link>
                    </td>
                    <td>
                      <span className="event-meta-text">{event.location}</span>
                    </td>
                    <td>
                      <span className="event-meta-text event-date-range">
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
                      <div className="event-reservation-cell">
                        {sortedReservations.length === 0 ? (
                          <div className="event-reservation-empty">
                            <span className="event-reservation-empty-title">
                              {event.computedStatus === "past" ? "No reserved items" : "No reserved items yet"}
                            </span>
                            <span className="event-reservation-empty-copy">
                              {event.computedStatus === "past"
                                ? "This event has no active reservation requests."
                                : "Reserve inventory to start building this event."}
                            </span>
                          </div>
                        ) : (
                          <div className="event-reservation-list">
                            {sortedReservations.slice(0, 3).map((reservation) => (
                              <div key={reservation.id} className="event-reservation-item">
                                <div className="event-reservation-copy">
                                  <Link
                                    href={`/inventory/${reservation.inventoryItemId}`}
                                    className="event-reservation-link"
                                  >
                                    {reservation.inventoryItem.title}
                                  </Link>
                                  <span className="event-reservation-qty">x{reservation.quantity}</span>
                                </div>
                                <span
                                  className={`event-reservation-status event-reservation-status-${reservation.status.toLowerCase()}`}
                                >
                                  {reservation.status === "PENDING" ? "Pending" : "Approved"}
                                </span>
                              </div>
                            ))}

                            {sortedReservations.length > 3 && (
                              <span className="event-reservation-more">
                                +{sortedReservations.length - 3} more request
                                {sortedReservations.length - 3 === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                        )}

                        {event.computedStatus !== "past" && (
                          <ReserveInventoryForEventButton
                            event={{
                              id: event.id,
                              eventName: event.eventName,
                              companyName: event.companyName,
                              location: event.location,
                              startDate: event.startDate.toISOString(),
                              endDate: event.endDate.toISOString(),
                            }}
                          />
                        )}
                      </div>
                    </td>
                    {showActions && (
                      <td className="event-action-cell">
                        <EventRowActions
                          event={{ id: event.id, eventName: event.eventName }}
                          isAdmin={isAdmin}
                        />
                      </td>
                    )}
                  </tr>
                );
              })()
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={totalCount} pageSize={PAGE_SIZE} currentPage={currentPage} />
    </>
  );
}
