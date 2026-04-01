import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { FilterDropdown } from "@/components/FilterDropdown";
import { StatusBadge } from "@/components/StatusBadge";
import { InventoryActions } from "./InventoryActions";
import { getInventoryAvailableQty } from "@/lib/availability";
import Image from "next/image";
import Link from "next/link";

const FILTER_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Retired", value: "RETIRED" },
];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const params = await searchParams;
  const query = params.q ?? "";
  const filter = params.filter ?? "";

  const items = await prisma.inventoryItem.findMany({
    where: {
      ...(filter ? { status: filter as "ACTIVE" | "RETIRED" } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { currentLocation: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { title: "asc" }],
    include: {
      updatedBy: { select: { name: true } },
    },
  });

  // Compute available quantity for each item (current date check — no specific event window)
  // For the table view, show total available (not tied to a specific event)
  const itemsWithAvailability = await Promise.all(
    items.map(async (item) => {
      // For table view: total qty minus any currently approved reservations
      const activeReservations = await prisma.inventoryReservation.aggregate({
        where: {
          inventoryItemId: item.id,
          status: "APPROVED",
        },
        _sum: { quantity: true },
      });
      const reserved = activeReservations._sum.quantity ?? 0;
      return {
        ...item,
        availableQty: Math.max(0, item.quantity - reserved),
        reservedQty: reserved,
      };
    })
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="View and manage inventory, checkout items for events"
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
        <span className="item-count">{itemsWithAvailability.length} items</span>
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

      <style>{`
        .table-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .item-count {
          font-size: 13px;
          color: #6b7280;
          margin-left: 4px;
        }
        .table-container {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table thead tr {
          background: white;
          border-bottom: 1px solid #e5e7eb;
        }
        .data-table th {
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          text-align: left;
          white-space: nowrap;
        }
        .data-table td {
          padding: 14px 16px;
          font-size: 14px;
          color: #111827;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: middle;
        }
        .table-row:last-child td {
          border-bottom: none;
        }
        .table-row:hover td {
          background: #f9fafb;
        }
        .row-retired td {
          opacity: 0.55;
        }
        .item-image {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .image-placeholder {
          width: 40px;
          height: 40px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
        }
        .item-title-link {
          font-weight: 500;
          color: #111827;
          text-decoration: none;
          transition: color 0.12s;
        }
        .item-title-link:hover {
          color: #00b4d8;
        }
        .text-muted {
          color: #6b7280;
        }
        .qty-available {
          font-weight: 500;
          color: #111827;
        }
        .qty-sep {
          color: #d1d5db;
          margin: 0 2px;
        }
        .qty-total {
          color: #6b7280;
        }
        .notes-indicator {
          font-size: 13px;
          color: #6b7280;
        }
        .empty-row {
          text-align: center;
          color: #9ca3af;
          padding: 48px 16px;
          font-size: 14px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: none;
          border-radius: 8px;
          padding: 9px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.12s;
          white-space: nowrap;
        }
        .btn-dark {
          background: #111827;
          color: white;
        }
        .btn-dark:hover {
          background: #1f2937;
        }
      `}</style>
    </>
  );
}
