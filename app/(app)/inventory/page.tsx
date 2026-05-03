import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { InventoryPageShell } from "./InventoryPageShell";
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
        updatedBy: { select: { name: true } },
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
      where: { endDate: { gte: todayStart } },
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
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
  }));
  const totalCount = items.length;

  return (
    <InventoryPageShell
      stripLegacyPaginationParams
      header={
        <PageHeader
          title="Inventory"
          action={
            isAdmin ? (
              <Link href="/inventory/new" className="btn btn-primary">
                + Add Item
              </Link>
            ) : undefined
          }
        />
      }
      controls={
        <div className="table-toolbar inventory-toolbar">
          <SearchBar placeholder="Search items, descriptions, locations..." />
          <span className="item-count">{totalCount} items</span>
        </div>
      }
      table={
        <InventoryTable
          items={items.map((item) => {
            const pendingCount = item.reservations.filter(
              (reservation) => reservation.status === "PENDING"
            ).length;
            const approvedCount = item.reservations.filter(
              (reservation) => reservation.status === "APPROVED"
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
              updatedDate: item.updatedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
              updatedByText: item.updatedBy?.name?.trim() ?? null,
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
