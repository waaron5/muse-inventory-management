import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { Pagination } from "@/components/Pagination";
import { LocationPinIcon } from "@/components/MetadataIcons";
import { InventoryActions } from "./InventoryActions";
import { InventoryImagePreview } from "./InventoryImagePreview";
import { InventoryPageShell } from "./InventoryPageShell";

const DEFAULT_PAGE_SIZE = 8;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string; retired?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session?.user.id ?? "";
  const params = await searchParams;
  const query = params.q ?? "";
  const showRetired = params.retired === "1";
  const pageSize = Math.max(
    1,
    parseInt(params.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE
  );
  const requestedPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const where = {
    ...(!showRetired ? { status: "ACTIVE" as const } : {}),
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

  const totalCount = await prisma.inventoryItem.count({ where });
  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, 1) / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);

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
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
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

  const baseToggleParams = new URLSearchParams({
    ...(query ? { q: query } : {}),
    ...(params.pageSize ? { pageSize: params.pageSize } : {}),
  });
  const showRetiredParams = new URLSearchParams(baseToggleParams.toString());
  showRetiredParams.set("retired", "1");
  const serializedAvailableEvents = availableEvents.map((event) => ({
    id: event.id,
    eventName: event.eventName,
    companyName: event.companyName,
    location: event.location,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
  }));

  return (
    <InventoryPageShell
      totalCount={totalCount}
      currentPage={currentPage}
      pageSize={pageSize}
      showPagination={totalCount > 0}
      header={
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
      }
      controls={
        <>
          <div className="table-toolbar inventory-toolbar">
            <SearchBar placeholder="Search items, descriptions, locations..." />
            <div className="toolbar-right">
              <Link
                href={
                  showRetired
                    ? baseToggleParams.toString()
                      ? `/inventory?${baseToggleParams.toString()}`
                      : "/inventory"
                    : `/inventory?${showRetiredParams.toString()}`
                }
                className="retired-toggle"
              >
                {showRetired ? "Hide retired" : "Show retired"}
              </Link>
              <span className="item-count">{totalCount} items</span>
            </div>
          </div>
          <p className="inventory-availability-note">
            Reserved counts are totals across all events. Exact availability per
            event is shown when reserving.
          </p>
        </>
      }
      table={
        <div className="table-container inventory-table-frame">
          <table className="data-table inventory-table">
            <thead>
              <tr>
                <th className="col-image">Image</th>
                <th className="col-item">Item</th>
                <th className="col-details">Details</th>
                <th className="col-qty">Qty</th>
                <th className="col-reserved">Reserved</th>
                <th className="col-location">Location</th>
                <th className="inventory-actions-header">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No inventory items found.
                  </td>
                </tr>
              )}
              {items.map((item) => {
                const pendingCount = item.reservations.filter(
                  (reservation) => reservation.status === "PENDING"
                ).length;
                const approvedCount = item.reservations.filter(
                  (reservation) => reservation.status === "APPROVED"
                ).length;
                const detailText = [item.description?.trim(), item.notes?.trim() ? `Note: ${item.notes.trim()}` : null]
                  .filter(Boolean)
                  .join(" • ");
                const updatedDate = item.updatedAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
                const updatedByText = item.updatedBy?.name?.trim();
                const reserved = reservedMap.get(item.id) ?? 0;

                return (
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
                        <div className="inventory-item-meta-row">
                          <span
                            className="inventory-item-meta-text"
                            title={
                              updatedByText
                                ? `Updated ${updatedDate} by ${updatedByText}`
                                : `Updated ${updatedDate}`
                            }
                          >
                            Updated {updatedDate}
                            {updatedByText ? ` by ${updatedByText}` : ""}
                          </span>
                          {pendingCount > 0 && (
                            <span className="action-status-chip action-status-chip-pending">
                              {pendingCount} pending
                            </span>
                          )}
                          {approvedCount > 0 && (
                            <span className="action-status-chip action-status-chip-approved">
                              {approvedCount} approved
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="col-details">
                      <span
                        className={`inventory-text-block inventory-details-text${
                          detailText ? "" : " inventory-details-empty"
                        }`}
                        title={detailText || undefined}
                      >
                        {detailText || "—"}
                      </span>
                    </td>
                    <td className="col-qty">
                      <span className="qty-primary">{item.quantity}</span>
                    </td>
                    <td className="col-reserved">
                      {reserved > 0 ? (
                        <span
                          className={`reserved-count${
                            reserved >= item.quantity ? " reserved-count-full" : ""
                          }`}
                        >
                          {reserved}
                        </span>
                      ) : (
                        <span className="reserved-count-none">—</span>
                      )}
                    </td>
                    <td className="col-location">
                      {item.currentLocation ? (
                        <span className="table-meta-inline inventory-location-inline">
                          <LocationPinIcon className="table-meta-icon" />
                          <span
                            className="inventory-text-block inventory-location-text"
                            title={item.currentLocation}
                          >
                            {item.currentLocation}
                          </span>
                        </span>
                      ) : (
                        <span className="inventory-text-block inventory-location-text">—</span>
                      )}
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
                        reservationState={{
                          pendingCount,
                          approvedCount,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      }
      pagination={
        <Pagination
          total={totalCount}
          pageSize={pageSize}
          currentPage={currentPage}
          alwaysShow
        />
      }
    />
  );
}
