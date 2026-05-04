import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SearchBar } from "@/components/SearchBar";
import { Pagination } from "@/components/Pagination";
import {
  CalendarIcon,
  ChevronDownIcon,
  GiftIcon,
  InventoryIcon,
  LocationPinIcon,
} from "@/components/MetadataIcons";
import { getEventStatus } from "@/lib/availability";
import { getGiftReservationStatusLabel } from "@/lib/gift-reservation-ui";
import { getInventoryReservationStatusLabel } from "@/lib/inventory-reservation-ui";
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
const COMPANY_COLOR_THEMES = [
  {
    accent: "#0f766e",
    soft: "rgba(15, 118, 110, 0.10)",
    border: "rgba(15, 118, 110, 0.24)",
  },
  {
    accent: "#1d4ed8",
    soft: "rgba(29, 78, 216, 0.10)",
    border: "rgba(29, 78, 216, 0.24)",
  },
  {
    accent: "#b45309",
    soft: "rgba(180, 83, 9, 0.10)",
    border: "rgba(180, 83, 9, 0.24)",
  },
  {
    accent: "#7c3aed",
    soft: "rgba(124, 58, 237, 0.10)",
    border: "rgba(124, 58, 237, 0.24)",
  },
  {
    accent: "#be123c",
    soft: "rgba(190, 18, 60, 0.10)",
    border: "rgba(190, 18, 60, 0.24)",
  },
  {
    accent: "#0369a1",
    soft: "rgba(3, 105, 161, 0.10)",
    border: "rgba(3, 105, 161, 0.24)",
  },
] as const;

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

function compareReservations<T extends { status: string; createdAt: Date }>(a: T, b: T) {
  const statusDiff =
    RESERVATION_STATUS_ORDER[a.status as keyof typeof RESERVATION_STATUS_ORDER] -
    RESERVATION_STATUS_ORDER[b.status as keyof typeof RESERVATION_STATUS_ORDER];

  if (statusDiff !== 0) return statusDiff;

  return b.createdAt.getTime() - a.createdAt.getTime();
}

function formatEventDateRange(startDate: Date, endDate: Date) {
  return `${startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function getCompanyTheme(companyName: string) {
  let hash = 0;
  for (const char of companyName) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return COMPANY_COLOR_THEMES[hash % COMPANY_COLOR_THEMES.length];
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
                { plCode: { contains: query, mode: "insensitive" } },
                { location: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
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

  const availableGiftOptions = availableGifts.map((gift) => ({
    id: gift.id,
    title: gift.title,
    totalQuantity: gift.quantity,
  }));

  const allEnriched = events
    .map((event) => {
      const sortedInventoryReservations = event.inventoryReservations
        .slice()
        .sort(compareReservations);
      const sortedGiftReservations = event.giftReservations
        .slice()
        .sort(compareReservations);

      const myPendingCount = sortedInventoryReservations.filter(
        (reservation) =>
          reservation.requestedById === userId && reservation.status === "PENDING"
      ).length;
      const myApprovedCount = sortedInventoryReservations.filter(
        (reservation) =>
          reservation.requestedById === userId && reservation.status === "APPROVED"
      ).length;

      return {
        ...event,
        computedStatus: getEventStatus(event.startDate, event.endDate),
        sortedInventoryReservations,
        sortedGiftReservations,
        myPendingCount,
        myApprovedCount,
      };
    })
    .sort(compareEventRows);

  const groupedByCompany = new Map<
    string,
    {
      companyName: string;
      events: typeof allEnriched;
    }
  >();

  for (const event of allEnriched) {
    const existingSection = groupedByCompany.get(event.companyName);

    if (existingSection) {
      existingSection.events.push(event);
      continue;
    }

    groupedByCompany.set(event.companyName, {
      companyName: event.companyName,
      events: [event],
    });
  }

  const companySections = Array.from(groupedByCompany.values()).sort((a, b) =>
    a.companyName.localeCompare(b.companyName)
  );
  const totalCount = companySections.length;
  const pagedSections = companySections.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

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
          <SearchBar placeholder="Search events, companies, P & L, locations..." />
        </div>
      }
      table={
        <div className="events-company-grid">
          {pagedSections.length === 0 ? (
            <div className="table-container">
              <div className="events-empty-state">No events found.</div>
            </div>
          ) : (
            pagedSections.map((section) => {
              const theme = getCompanyTheme(section.companyName);
              const sectionStyle = {
                "--company-accent": theme.accent,
                "--company-accent-soft": theme.soft,
                "--company-accent-border": theme.border,
              } as CSSProperties;

              return (
                <section
                  key={section.companyName}
                  className="events-company-section"
                  style={sectionStyle}
                >
                  <div className="table-container events-company-table-container">
                    <div className="events-company-table-header">
                      <div className="events-company-banner-main">
                        <span className="events-company-badge" aria-hidden="true">
                          {section.companyName.charAt(0).toUpperCase()}
                        </span>
                        <div className="events-company-copy">
                          <h2 className="events-company-name">{section.companyName}</h2>
                        </div>
                      </div>
                    </div>

                    <table className="data-table events-table">
                      <thead>
                        <tr>
                          <th className="events-col-event">Event Name</th>
                          <th className="events-col-location">Location &amp; Dates</th>
                          <th className="events-col-pl">P &amp; L</th>
                          <th className="events-col-assignments">Inventory</th>
                          <th className="events-col-assignments">Gifts</th>
                          {showActions && (
                            <th className="event-actions-header">
                              <span className="sr-only">Actions</span>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {section.events.map((event) => (
                          <tr
                            key={event.id}
                            className={`table-row event-row ${event.computedStatus === "past" ? "row-past" : ""}`}
                          >
                            <td className="events-col-event">
                              <div className="event-primary-cell">
                                <Link href={`/events/${event.id}`} className="event-title-link">
                                  {event.eventName}
                                </Link>
                              </div>
                            </td>
                            <td className="events-col-location">
                              <div className="event-detail-stack">
                                <div className="table-meta-inline event-detail-line">
                                  <LocationPinIcon className="table-meta-icon" />
                                  <span className="event-meta-text">{event.location}</span>
                                </div>
                                <div className="table-meta-inline event-detail-line">
                                  <CalendarIcon className="table-meta-icon" />
                                  <span className="event-meta-text event-date-range">
                                    {formatEventDateRange(event.startDate, event.endDate)}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="events-col-pl">
                              <span
                                className={`event-pl-code${event.plCode ? "" : " event-pl-code-empty"}`}
                              >
                                {event.plCode ?? "—"}
                              </span>
                            </td>
                            <td className="events-col-assignments">
                              <details className="event-assignment-panel">
                                <summary className="event-assignment-summary">
                                  <span className="event-assignment-heading">
                                    <InventoryIcon className="event-assignment-icon" />
                                    <span>Inventory</span>
                                  </span>
                                  <ChevronDownIcon className="event-assignment-chevron" />
                                </summary>

                                <div className="event-assignment-content">
                                  {event.sortedInventoryReservations.length === 0 ? (
                                    <p className="event-assignment-empty">
                                      No inventory assigned to this event yet.
                                    </p>
                                  ) : (
                                    <div className="event-reservation-list">
                                      {event.sortedInventoryReservations.map((reservation) => (
                                        <div key={reservation.id} className="event-reservation-item">
                                          <div className="event-reservation-copy">
                                            <Link
                                              href={`/inventory/${reservation.inventoryItemId}`}
                                              className="event-reservation-link"
                                            >
                                              {reservation.inventoryItem.title}
                                            </Link>
                                            <span className="event-reservation-qty">
                                              x{reservation.quantity}
                                            </span>
                                          </div>
                                          <span
                                            className={`event-reservation-status event-reservation-status-${reservation.status.toLowerCase()}`}
                                          >
                                            {getInventoryReservationStatusLabel(reservation.status)}
                                          </span>
                                        </div>
                                      ))}
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
                                        pendingCount: event.myPendingCount,
                                        approvedCount: event.myApprovedCount,
                                      }}
                                      variant="text"
                                    />
                                  )}
                                </div>
                              </details>
                            </td>
                            <td className="events-col-assignments">
                              <details className="event-assignment-panel">
                                <summary className="event-assignment-summary">
                                  <span className="event-assignment-heading">
                                    <GiftIcon className="event-assignment-icon" />
                                    <span>Gifts</span>
                                  </span>
                                  <ChevronDownIcon className="event-assignment-chevron" />
                                </summary>

                                <div className="event-assignment-content">
                                  {event.sortedGiftReservations.length === 0 ? (
                                    <p className="event-assignment-empty">
                                      No gifts assigned to this event yet.
                                    </p>
                                  ) : (
                                    <div className="event-reservation-list">
                                      {event.sortedGiftReservations.map((reservation) => (
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
                                      availableGifts={availableGiftOptions}
                                    />
                                  )}
                                </div>
                              </details>
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })
          )}
        </div>
      }
      showPagination={totalCount > PAGE_SIZE}
      pagination={
        <Pagination total={totalCount} pageSize={PAGE_SIZE} currentPage={currentPage} />
      }
    />
  );
}
