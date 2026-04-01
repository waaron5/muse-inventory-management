import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { FilterDropdown } from "@/components/FilterDropdown";
import { StatusBadge } from "@/components/StatusBadge";
import Link from "next/link";
import { GiftRowActions } from "./GiftRowActions";

const FILTER_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Consumed", value: "CONSUMED" },
];

export default async function GiftingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const params = await searchParams;
  const query = params.q ?? "";
  const filter = params.filter ?? "";

  const items = await prisma.giftItem.findMany({
    where: {
      ...(filter ? { status: filter as "ACTIVE" | "CONSUMED" } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { title: "asc" }],
    include: {
      updatedBy: { select: { name: true } },
    },
  });

  const itemsWithAvailability = await Promise.all(
    items.map(async (item) => {
      const activeReservations = await prisma.giftReservation.aggregate({
        where: { giftItemId: item.id, status: "APPROVED" },
        _sum: { quantity: true },
      });
      const reserved = activeReservations._sum.quantity ?? 0;
      return { ...item, availableQty: Math.max(0, item.quantity - reserved) };
    })
  );

  return (
    <>
      <PageHeader
        title="Gifting"
        subtitle="Manage consumable gift items and event gift reservations"
        action={
          isAdmin ? (
            <Link href="/gifting/new" className="btn btn-dark">
              + Add Gift
            </Link>
          ) : undefined
        }
      />

      <div className="table-toolbar">
        <SearchBar placeholder="Search gifts, descriptions..." />
        <FilterDropdown options={FILTER_OPTIONS} defaultLabel="All Gifts" paramName="filter" />
        <span className="item-count">{itemsWithAvailability.length} items</span>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th>Avail / Total</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {itemsWithAvailability.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No gift items found.
                </td>
              </tr>
            )}
            {itemsWithAvailability.map((item) => (
              <tr
                key={item.id}
                className={`table-row ${item.status === "CONSUMED" ? "row-consumed" : ""}`}
              >
                <td>
                  <Link
                    href={`/gifting/${item.id}`}
                    className={`item-title-link ${item.status === "CONSUMED" ? "strikethrough" : ""}`}
                  >
                    {item.title}
                  </Link>
                </td>
                <td>
                  <span className="text-muted">{item.description ?? "—"}</span>
                </td>
                <td>
                  <span className="qty-available">{item.availableQty}</span>
                  <span className="qty-sep"> / </span>
                  <span className="qty-total">{item.quantity}</span>
                </td>
                <td>
                  <StatusBadge variant={item.status === "ACTIVE" ? "active" : "consumed"} />
                </td>
                <td>
                  {item.notes ? (
                    <span className="text-muted">
                      {item.notes.length > 30 ? item.notes.slice(0, 30) + "…" : item.notes}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <span className="text-muted">
                    {item.updatedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </td>
                <td>
                  <GiftRowActions item={item} isAdmin={isAdmin} />
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
          border-bottom: 1px solid #e5e7eb;
        }
        .data-table th {
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          text-align: left;
        }
        .data-table td {
          padding: 14px 16px;
          font-size: 14px;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: middle;
        }
        .table-row:last-child td { border-bottom: none; }
        .table-row:hover td { background: #f9fafb; }
        .row-consumed td { opacity: 0.55; }
        .item-title-link {
          font-weight: 500;
          color: #111827;
          text-decoration: none;
        }
        .item-title-link:hover { color: #00b4d8; }
        .strikethrough { text-decoration: line-through; }
        .text-muted { color: #6b7280; }
        .qty-available { font-weight: 500; color: #111827; }
        .qty-sep { color: #d1d5db; margin: 0 2px; }
        .qty-total { color: #6b7280; }
        .empty-row {
          text-align: center;
          color: #9ca3af;
          padding: 48px 16px;
          font-size: 14px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
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
        .btn-dark { background: #111827; color: white; }
        .btn-dark:hover { background: #1f2937; }
      `}</style>
    </>
  );
}
