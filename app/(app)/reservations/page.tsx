import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { NewReservationButton } from "./NewReservationButton";
import { PendingReservationsTable } from "./PendingReservationsTable";

const RESERVATION_STATUS_ORDER: Record<string, number> = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  CANCELED: 3,
  COMPLETED: 4,
};

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function ReservationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isAdmin = session.user.role === "ADMIN";
  const userId = session.user.id;
  const todayStart = getTodayStart();

  const [reservations, availableEvents] = await Promise.all([
    prisma.inventoryReservation.findMany({
      where: isAdmin ? undefined : { requestedById: userId },
      include: {
        inventoryItem: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            currentLocation: true,
          },
        },
        event: {
          select: {
            id: true,
            eventName: true,
            companyName: true,
            startDate: true,
            endDate: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.event.findMany({
      where: {
        endDate: {
          gte: todayStart,
        },
      },
      select: {
        id: true,
        eventName: true,
        companyName: true,
        location: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: "asc" },
    }),
  ]);
  const sortedReservations = [...reservations].sort((a, b) => {
    const statusDiff =
      (RESERVATION_STATUS_ORDER[a.status] ?? 99) -
      (RESERVATION_STATUS_ORDER[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const serializedEvents = availableEvents.map((event) => ({
    id: event.id,
    eventName: event.eventName,
    companyName: event.companyName,
    location: event.location,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
  }));

  const emptyMessage = isAdmin
    ? "No inventory reservations yet."
    : "You do not have any inventory reservations yet.";

  return (
    <>
      <PageHeader
        title="Reservations"
        subtitle="Create and track inventory reservations. Pending requests do not hold inventory until approved."
        action={<NewReservationButton availableEvents={serializedEvents} />}
      />

      <div className="reservations-toolbar">
        <span className="reservations-count">
          {sortedReservations.length}{" "}
          {sortedReservations.length === 1 ? "reservation" : "reservations"}
        </span>
      </div>

      <PendingReservationsTable
        reservations={sortedReservations.map((r) => ({
          id: r.id,
          status: r.status,
          quantity: r.quantity,
          requestedById: r.requestedById,
          inventoryItem: {
            id: r.inventoryItem.id,
            title: r.inventoryItem.title,
            imageUrl: r.inventoryItem.imageUrl,
            currentLocation: r.inventoryItem.currentLocation,
          },
          event: {
            id: r.event.id,
            eventName: r.event.eventName,
            companyName: r.event.companyName,
            startDate: r.event.startDate.toISOString(),
            endDate: r.event.endDate.toISOString(),
          },
          requestedBy: {
            id: r.requestedBy.id,
            name: r.requestedBy.name ?? "Unknown",
          },
        }))}
        isAdmin={isAdmin}
        userId={userId}
        emptyMessage={emptyMessage}
      />
    </>
  );
}
