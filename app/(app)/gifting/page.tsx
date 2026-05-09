import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SearchBar } from "@/components/SearchBar";
import { InventoryImagePreview } from "@/app/(app)/inventory/InventoryImagePreview";
import { PageShell } from "@/components/PageShell";
import { GiftRowActions } from "./GiftRowActions";

export default async function GiftingPage({
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
            { notes: { contains: query, mode: "insensitive" as const } },
            { currentLocation: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, availableEvents] = await Promise.all([
    prisma.giftItem.findMany({
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

  const serializedAvailableEvents = availableEvents.map((event) => ({
    id: event.id,
    eventName: event.eventName,
    companyName: event.companyName,
    location: event.location,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
  }));
  return (
    <PageShell
      stripLegacyPaginationParams
      title="Gifting"
      action={
        isAdmin ? (
          <Link href="/gifting/new" className="btn btn-primary">
            + Add Item
          </Link>
        ) : undefined
      }
      controls={
        <div className="table-toolbar inventory-toolbar">
          <SearchBar placeholder="Search items, descriptions, and locations..." />
        </div>
      }
      table={
        <div className="table-container inventory-table-frame">
          <table className="data-table inventory-table gifting-table">
            <thead>
              <tr>
                <th className="col-image">
                  <span className="sr-only">Image</span>
                </th>
                <th className="col-item">Item</th>
                <th className="col-qty">Qty</th>
                <th className="inventory-actions-header">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No gift items found.
                  </td>
                </tr>
              )}
              {items.map((item) => {
                const pendingCount = item.reservations.filter(
                  (reservation) => reservation.status === "PENDING",
                ).length;
                const approvedCount = item.reservations.filter(
                  (reservation) => reservation.status === "APPROVED",
                ).length;

                return (
                  <tr
                    key={item.id}
                    className={`table-row ${item.status === "CONSUMED" ? "row-consumed" : ""}`}
                  >
                    <td className="col-image">
                      <InventoryImagePreview src={item.imageUrl ?? null} alt={item.title} />
                    </td>
                    <td className="col-item">
                      <div className="inventory-item-cell">
                        <Link
                          href={`/gifting/${item.id}`}
                          className={`item-title-link inventory-item-link${
                            item.status === "CONSUMED" ? " inventory-item-link-retired" : ""
                          }`}
                        >
                          {item.title}
                        </Link>
                      </div>
                    </td>
                    <td className="col-qty">
                      <span className="qty-primary">{item.quantity}</span>
                    </td>
                    <td className="inventory-action-cell">
                      <GiftRowActions
                        item={{
                          id: item.id,
                          title: item.title,
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
    />
  );
}
