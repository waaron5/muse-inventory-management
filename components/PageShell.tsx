"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSetTopBar } from "@/components/TopBarContext";

export const INVENTORY_BULK_DOCK_SLOT_ID = "inventory-bulk-dock-slot";

export function useInventoryBulkDockSlot() {
  const [bulkDockSlot, setBulkDockSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    function updateBulkDockSlot() {
      const nextSlot = document.getElementById(INVENTORY_BULK_DOCK_SLOT_ID);
      setBulkDockSlot((currentSlot) => (currentSlot === nextSlot ? currentSlot : nextSlot));
    }

    updateBulkDockSlot();

    const observer = new MutationObserver(() => {
      updateBulkDockSlot();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return bulkDockSlot;
}

interface PageShellProps {
  showPagination?: boolean;
  title: ReactNode;
  action?: ReactNode;
  controls: ReactNode;
  table: ReactNode;
  pagination?: ReactNode;
  stripLegacyPaginationParams?: boolean;
}

export function PageShell({
  showPagination = false,
  title,
  action,
  controls,
  table,
  pagination,
  stripLegacyPaginationParams = false,
}: PageShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const actionsContent = useMemo(
    () => (
      <>
        <div id={INVENTORY_BULK_DOCK_SLOT_ID} className="inventory-page-bulk-dock-slot" />
        {controls}
        {action}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controls, action],
  );
  useSetTopBar(title, actionsContent);

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
      <div className="inventory-page-table-area">
        <div className="inventory-page-table-shell">{table}</div>
      </div>
      {showPagination ? <div className="inventory-page-pagination">{pagination}</div> : null}
    </div>
  );
}
