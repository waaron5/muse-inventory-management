import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { FilterDropdown } from "@/components/FilterDropdown";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import Link from "next/link";
import { GiftRowActions } from "./GiftRowActions";

const FILTER_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Consumed", value: "CONSUMED" },
];

const PAGE_SIZE = 20;

export default async function GiftingPage({
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
    ...(filter ? { status: filter as "ACTIVE" | "CONSUMED" } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, totalCount] = await Promise.all([
    prisma.giftItem.findMany({
      where,
      orderBy: [{ status: "asc" }, { title: "asc" }],
      include: {
        updatedBy: { select: { name: true } },
      },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.giftItem.count({ where }),
  ]);

  // Batch: get reserved quantities for all items in one query instead of N+1
  const itemIds = items.map((i) => i.id);
  const reservedAgg = await prisma.giftReservation.groupBy({
    by: ["giftItemId"],
    where: {
      giftItemId: { in: itemIds },
      status: "APPROVED",
    },
    _sum: { quantity: true },
  });

  const reservedMap = new Map(
    reservedAgg.map((r) => [r.giftItemId, r._sum.quantity ?? 0])
  );

  const itemsWithAvailability = items.map((item) => {
    const reserved = reservedMap.get(item.id) ?? 0;
    return { ...item, availableQty: Math.max(0, item.quantity - reserved) };
  });

  return (
    <>
      <PageHeader
        title="Gifting"
        subtitle="Manage and reserve gifts"
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
        <span className="item-count">{totalCount} items</span>
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

      <Pagination total={totalCount} pageSize={PAGE_SIZE} currentPage={currentPage} />
    </>
  );
}
