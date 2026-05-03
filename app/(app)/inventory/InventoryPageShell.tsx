"use client";

import { type ReactNode, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const INVENTORY_BULK_DOCK_SLOT_ID = "inventory-bulk-dock-slot";

interface InventoryPageShellProps {
  showPagination?: boolean;
  header: ReactNode;
  controls: ReactNode;
  table: ReactNode;
  pagination?: ReactNode;
  stripLegacyPaginationParams?: boolean;
}

export function InventoryPageShell({
  showPagination = false,
  header,
  controls,
  table,
  pagination,
  stripLegacyPaginationParams = false,
}: InventoryPageShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!stripLegacyPaginationParams) {
      return;
    }

    if (!searchParams.has("page") && !searchParams.has("pageSize")) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("pageSize");

    const nextSearch = params.toString();
    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams, stripLegacyPaginationParams]);

  return (
    <div className="inventory-page-shell">
      <div className="inventory-page-topbar">{header}</div>
      <div className="inventory-page-controls">
        <div className="inventory-page-controls-row">
          <div className="inventory-page-controls-main">{controls}</div>
          <div
            id={INVENTORY_BULK_DOCK_SLOT_ID}
            className="inventory-page-bulk-dock-slot"
          />
        </div>
      </div>
      <div className="inventory-page-table-area">
        <div className="inventory-page-table-shell">{table}</div>
      </div>
      {showPagination ? (
        <div className="inventory-page-pagination">
          {pagination}
        </div>
      ) : null}
    </div>
  );
}
