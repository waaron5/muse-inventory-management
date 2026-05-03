import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SearchBar } from "@/components/SearchBar";
import { InventoryPageShell } from "@/app/(app)/inventory/InventoryPageShell";
import { getStorageLocationNames } from "@/lib/storage-locations";
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

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isAdmin = session.user.role === "ADMIN";
  const userId = session.user.id;
  const params = await searchParams;
  const query = params.q ?? "";
  const todayStart = getTodayStart();
  const where = {
    ...(isAdmin ? {} : { requestedById: userId }),
    ...(query
      ? {
          OR: [
            {
              inventoryItem: {
                title: { contains: query, mode: "insensitive" as const },
              },
            },
            {
              inventoryItem: {
                currentLocation: { contains: query, mode: "insensitive" as const },
              },
            },
            {
              event: {
                eventName: { contains: query, mode: "insensitive" as const },
              },
            },
            {
              event: {
                companyName: { contains: query, mode: "insensitive" as const },
              },
            },
            {
              requestedBy: {
                name: { contains: query, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };

  const [reservations, availableEvents, returnLocationOptions] = await Promise.all([
    prisma.inventoryReservation.findMany({
      where,
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
    getStorageLocationNames(),
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
    <InventoryPageShell
      stripLegacyPaginationParams
      title="Reservations"
      action={<NewReservationButton availableEvents={serializedEvents} />}
      controls={
        <div className="table-toolbar inventory-toolbar">
          <SearchBar placeholder="Search items, events, requesters..." />
        </div>
      }
      table={
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
          returnLocationOptions={returnLocationOptions}
        />
      }
    />
  );
}
