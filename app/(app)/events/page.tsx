import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SearchBar } from "@/components/SearchBar";
import { Pagination } from "@/components/Pagination";
import { CalendarIcon, LocationPinIcon } from "@/components/MetadataIcons";
import { getEventStatus } from "@/lib/availability";
import { getGiftReservationStatusLabel } from "@/lib/gift-reservation-ui";
import { getInventoryReservationStatusLabel } from "@/lib/inventory-reservation-ui";
import Link from "next/link";
import { EventRowActions } from "./EventRowActions";
import { ReserveInventoryForEventButton } from "./ReserveInventoryForEventButton";
import { RequestGiftsForEventButton } from "./RequestGiftsForEventButton";
import { InventoryPageShell } from "@/app/(app)/inventory/InventoryPageShell";

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
  const userId = session?.user.id ?? "";
  const params = await searchParams;
  const query = params.q ?? "";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const showActions = isAdmin;

  const [events, availableGifts] = await Promise.all([
    prisma.event.findMany({
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
        giftReservations: {
          where: {
            status: { in: [...ACTIVE_RESERVATION_STATUSES] },
          },
          include: {
            giftItem: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    }),
    prisma.giftItem.findMany({
      where: { status: "ACTIVE" },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        quantity: true,
      },
    }),
  ]);

  const allEnriched = events
    .map((e) => ({
      ...e,
      computedStatus: getEventStatus(e.startDate, e.endDate),
    }))
    .sort(compareEventRows);

  const totalCount = allEnriched.length;
  const enriched = allEnriched.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <InventoryPageShell
      title="Events"
      action={
        isAdmin ? (
          <Link href="/events/new" className="btn btn-primary">
            + Create Event
          </Link>
        ) : undefined
      }
      controls={
        <div className="table-toolbar">
          <SearchBar placeholder="Search events, companies, locations..." />
        </div>
      }
      table={
        <div className="table-container">
          <table className="data-table events-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Location &amp; Date</th>
                <th>Inventory</th>
                <th>Gifts</th>
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
                  <td colSpan={showActions ? 5 : 4} className="empty-row">
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
                  const sortedGiftReservations = event.giftReservations
                    .slice()
                    .sort((a, b) => {
                      const statusDiff =
                        RESERVATION_STATUS_ORDER[a.status as keyof typeof RESERVATION_STATUS_ORDER] -
                        RESERVATION_STATUS_ORDER[b.status as keyof typeof RESERVATION_STATUS_ORDER];
                      if (statusDiff !== 0) return statusDiff;
                      return b.createdAt.getTime() - a.createdAt.getTime();
                    });
                  const myPendingCount = sortedReservations.filter(
                    (reservation) =>
                      reservation.requestedById === userId && reservation.status === "PENDING"
                  ).length;
                  const myApprovedCount = sortedReservations.filter(
                    (reservation) =>
                      reservation.requestedById === userId && reservation.status === "APPROVED"
                  ).length;

                  return (
                    <tr
                      key={event.id}
                      className={`table-row event-row ${event.computedStatus === "past" ? "row-past" : ""}`}
                    >
                      <td>
                        <div className="event-primary-cell">
                          <Link href={`/events/${event.id}`} className="event-title-link">
                            {event.eventName}
                          </Link>
                          <span className="event-meta-text">{event.companyName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="event-detail-stack">
                          <div className="table-meta-inline event-detail-line">
                            <LocationPinIcon className="table-meta-icon" />
                            <span className="event-meta-text">{event.location}</span>
                          </div>
                          <div className="table-meta-inline event-detail-line">
                            <CalendarIcon className="table-meta-icon" />
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
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="event-reservation-cell">
                          {sortedReservations.length === 0 ? (
                            <></>
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
                                    {getInventoryReservationStatusLabel(reservation.status)}
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
                              reservationState={{
                                pendingCount: myPendingCount,
                                approvedCount: myApprovedCount,
                              }}
                              variant="text"
                            />
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="event-reservation-cell event-gift-cell">
                          {sortedGiftReservations.length === 0 ? (
                            <></>
                          ) : (
                            <div className="event-reservation-list">
                              {sortedGiftReservations.slice(0, 3).map((reservation) => (
                                <div key={reservation.id} className="event-reservation-item">
                                  <div className="event-reservation-copy">
                                    <Link
                                      href={`/gifting/${reservation.giftItemId}`}
                                      className="event-reservation-link"
                                    >
                                      {reservation.giftItem.title}
                                    </Link>
                                    <span className="event-reservation-qty">
                                      x{reservation.quantity}
                                    </span>
                                  </div>
                                  <span
                                    className={`event-reservation-status event-reservation-status-${reservation.status.toLowerCase()}`}
                                  >
                                    {getGiftReservationStatusLabel(reservation.status)}
                                  </span>
                                </div>
                              ))}

                              {sortedGiftReservations.length > 3 && (
                                <span className="event-reservation-more">
                                  +{sortedGiftReservations.length - 3} more request
                                  {sortedGiftReservations.length - 3 === 1 ? "" : "s"}
                                </span>
                              )}
                            </div>
                          )}

                          {event.computedStatus !== "past" && (
                            <RequestGiftsForEventButton
                              event={{
                                id: event.id,
                                eventName: event.eventName,
                                companyName: event.companyName,
                                location: event.location,
                                startDate: event.startDate.toISOString(),
                                endDate: event.endDate.toISOString(),
                              }}
                              availableGifts={availableGifts.map((gift) => ({
                                id: gift.id,
                                title: gift.title,
                                totalQuantity: gift.quantity,
                              }))}
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
      }
      showPagination
      pagination={
        <Pagination total={totalCount} pageSize={PAGE_SIZE} currentPage={currentPage} />
      }
    />
  );
}
