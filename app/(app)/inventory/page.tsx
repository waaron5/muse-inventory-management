import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SearchBar } from "@/components/SearchBar";
import { PageShell } from "@/components/PageShell";
import { AddInventoryItemButton } from "./AddInventoryItemButton";
import { InventoryTable } from "./InventoryTable";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session?.user.id ?? "";
  const params = await searchParams;
  const query = params.q ?? "";
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const where = {
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
            { currentLocation: { contains: query, mode: "insensitive" as const } },
            { notes: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, availableEvents] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: [{ status: "asc" }, { title: "asc" }],
      include: {
        reservations: {
          where: {
            requestedById: userId,
            status: { in: ["PENDING", "APPROVED"] },
          },
          select: { status: true },
        },
      },
    }),
    prisma.event.findMany({
      where: { OR: [{ endDate: { gte: todayStart } }, { endDate: null }] },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        eventName: true,
        companyName: true,
        location: true,
        startDate: true,
        endDate: true,
      },
    }),
  ]);

  const itemIds = items.map((item) => item.id);
  const reservedAggregates =
    itemIds.length > 0
      ? await prisma.inventoryReservation.groupBy({
          by: ["inventoryItemId"],
          where: {
            inventoryItemId: { in: itemIds },
            status: "APPROVED",
          },
          _sum: { quantity: true },
        })
      : [];

  const reservedMap = new Map<string, number>();
  for (const aggregate of reservedAggregates) {
    if (aggregate._sum.quantity) {
      reservedMap.set(aggregate.inventoryItemId, aggregate._sum.quantity);
    }
  }
  const serializedAvailableEvents = availableEvents.map((event) => ({
    id: event.id,
    eventName: event.eventName,
    companyName: event.companyName,
    location: event.location,
    startDate: event.startDate?.toISOString() ?? null,
    endDate: event.endDate?.toISOString() ?? null,
  }));
  return (
    <PageShell
      stripLegacyPaginationParams
      title="Inventory"
      action={isAdmin ? <AddInventoryItemButton /> : undefined}
      controls={
        <div className="table-toolbar inventory-toolbar">
          <SearchBar placeholder="Search items, descriptions, locations..." />
        </div>
      }
      table={
        <InventoryTable
          items={items.map((item) => {
            const pendingCount = item.reservations.filter(
              (reservation) => reservation.status === "PENDING",
            ).length;
            const approvedCount = item.reservations.filter(
              (reservation) => reservation.status === "APPROVED",
            ).length;

            return {
              id: item.id,
              title: item.title,
              imageUrl: item.imageUrl ?? null,
              currentLocation: item.currentLocation ?? null,
              quantity: item.quantity,
              status: item.status,
              detailText: [
                item.description?.trim(),
                item.notes?.trim() ? `Note: ${item.notes.trim()}` : null,
              ]
                .filter(Boolean)
                .join(" • "),
              pendingCount,
              approvedCount,
              reserved: reservedMap.get(item.id) ?? 0,
            };
          })}
          isAdmin={isAdmin}
          availableEvents={serializedAvailableEvents}
        />
      }
    />
  );
}
