import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { FilterDropdown } from "@/components/FilterDropdown";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import { InventoryActions } from "./InventoryActions";
import { getInventoryAvailableQty } from "@/lib/availability";
import Image from "next/image";
import Link from "next/link";

const FILTER_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Retired", value: "RETIRED" },
];

const PAGE_SIZE = 20;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const params = await searchParams;
  const query = params.q ?? "";
  const filter = params.filter ?? "";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const where = {
    ...(filter ? { status: filter as "ACTIVE" | "RETIRED" } : {}),
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

  const [items, totalCount] = await Promise.all([
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
        <FilterDropdown
          options={FILTER_OPTIONS}
          defaultLabel="All Items"
          paramName="filter"
        />
        <span className="item-count">{totalCount} items</span>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="col-image">Image</th>
              <th className="col-item">Item</th>
              <th className="col-desc">Description</th>
              <th className="col-qty">Avail / Total</th>
              <th className="col-location">Location</th>
              <th className="col-status">Status</th>
              <th className="col-notes">Notes</th>
              <th className="col-updated">Last Updated</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {itemsWithAvailability.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-row">
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
                  <div className="item-image">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        width={40}
                        height={40}
                        style={{ objectFit: "cover", borderRadius: 4 }}
                      />
                    ) : (
                      <div className="image-placeholder" />
                    )}
                  </div>
                </td>
                <td className="col-item">
                  <Link href={`/inventory/${item.id}`} className="item-title-link">
                    {item.title}
                  </Link>
                </td>
                <td className="col-desc">
                  <span className="text-muted">{item.description ?? "—"}</span>
                </td>
                <td className="col-qty">
                  <span className="qty-available">{item.availableQty}</span>
                  <span className="qty-sep"> / </span>
                  <span className="qty-total">{item.quantity}</span>
                </td>
                <td className="col-location">
                  <span className="text-muted">{item.currentLocation ?? "—"}</span>
                </td>
                <td className="col-status">
                  <StatusBadge
                    variant={item.status === "ACTIVE" ? "active" : "retired"}
                  />
                </td>
                <td className="col-notes">
                  {item.notes ? (
                    <span className="notes-indicator" title={item.notes}>
                      {item.notes.length > 30
                        ? item.notes.slice(0, 30) + "…"
                        : item.notes}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="col-updated">
                  <span className="text-muted">
                    {item.updatedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </td>
                <td className="col-actions">
                  <InventoryActions item={item} isAdmin={isAdmin} />
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
