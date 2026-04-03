import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { Pagination } from "@/components/Pagination";
import { LocationPinIcon } from "@/components/MetadataIcons";
import { InventoryActions } from "./InventoryActions";
import { InventoryImagePreview } from "./InventoryImagePreview";
import Link from "next/link";

const PAGE_SIZE = 8;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const params = await searchParams;
  const query = params.q ?? "";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const where = {
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
            { currentLocation: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, totalCount, availableEvents] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: [{ status: "asc" }, { title: "asc" }],
      include: {
        updatedBy: { select: { name: true } },
      },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.inventoryItem.count({ where }),
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

  // Batch: get reserved quantities for all items in one query instead of N+1
  const itemIds = items.map((i) => i.id);
  const reservedAgg = await prisma.inventoryReservation.groupBy({
    by: ["inventoryItemId"],
    where: {
      inventoryItemId: { in: itemIds },
      status: "APPROVED",
    },
    _sum: { quantity: true },
  });

  const reservedMap = new Map(
    reservedAgg.map((r) => [r.inventoryItemId, r._sum.quantity ?? 0])
  );

  const itemsWithAvailability = items.map((item) => {
    const reserved = reservedMap.get(item.id) ?? 0;
    return {
      ...item,
      availableQty: Math.max(0, item.quantity - reserved),
      reservedQty: reserved,
    };
  });
  const serializedAvailableEvents = availableEvents.map((event) => ({
    id: event.id,
    eventName: event.eventName,
    companyName: event.companyName,
    location: event.location,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="View and manage inventory, reserve items for events"
        action={
          isAdmin ? (
            <Link href="/inventory/new" className="btn btn-dark">
              + Add Item
            </Link>
          ) : undefined
        }
      />

      <div className="table-toolbar">
        <SearchBar placeholder="Search items, descriptions, locations..." />
        <span className="item-count">{totalCount} items</span>
      </div>

      <div className="table-container">
        <table className="data-table inventory-table">
          <thead>
            <tr>
              <th className="col-image">Image</th>
              <th className="col-item">Item</th>
              <th className="col-desc">Description</th>
              <th className="col-qty">Avail / Total</th>
              <th className="col-location">Location</th>
              <th className="col-notes">Notes</th>
              <th className="col-updated">Last Updated</th>
              <th className="inventory-actions-header">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {itemsWithAvailability.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">
                  No inventory items found.
                </td>
              </tr>
            )}
            {itemsWithAvailability.map((item) => (
              <tr
                key={item.id}
                className={`table-row ${item.status === "RETIRED" ? "row-retired" : ""}`}
              >
                <td className="col-image">
                  <InventoryImagePreview src={item.imageUrl ?? null} alt={item.title} />
                </td>
                <td className="col-item">
                  <div className="inventory-item-cell">
                    <Link
                      href={`/inventory/${item.id}`}
                      className={`item-title-link inventory-item-link${
                        item.status === "RETIRED" ? " inventory-item-link-retired" : ""
                      }`}
                    >
                      {item.title}
                    </Link>
                  </div>
                </td>
                <td className="col-desc">
                  <span className="inventory-text-block inventory-description-text">
                    {item.description ?? "—"}
                  </span>
                </td>
                <td className="col-qty">
                  <span className="qty-available">{item.availableQty}</span>
                  <span className="qty-sep"> / </span>
                  <span className="qty-total">{item.quantity}</span>
                </td>
                <td className="col-location">
                  {item.currentLocation ? (
                    <span className="table-meta-inline">
                      <LocationPinIcon className="table-meta-icon" />
                      <span className="inventory-text-block inventory-location-text">
                        {item.currentLocation}
                      </span>
                    </span>
                  ) : (
                    <span className="inventory-text-block inventory-location-text">—</span>
                  )}
                </td>
                <td className="col-notes">
                  {item.notes ? (
                    <span className="inventory-text-block inventory-notes-text" title={item.notes}>
                      {item.notes}
                    </span>
                  ) : (
                    <span className="inventory-text-block inventory-notes-text">—</span>
                  )}
                </td>
                <td className="col-updated">
                  <div className="inventory-updated-cell">
                    <span className="inventory-updated-date">
                      {item.updatedAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="inventory-updated-user">
                      {item.updatedBy?.name ?? "—"}
                    </span>
                  </div>
                </td>
                <td className="inventory-action-cell">
                  <InventoryActions
                    item={{
                      id: item.id,
                      title: item.title,
                      currentLocation: item.currentLocation ?? null,
                      quantity: item.quantity,
                      status: item.status,
                    }}
                    isAdmin={isAdmin}
                    availableEvents={serializedAvailableEvents}
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
