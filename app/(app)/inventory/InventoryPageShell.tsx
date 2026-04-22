"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const ESTIMATED_ROW_HEIGHT = 88;
const FALLBACK_HEADER_HEIGHT = 45;
export const INVENTORY_BULK_DOCK_SLOT_ID = "inventory-bulk-dock-slot";

interface InventoryPageShellProps {
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  showPagination?: boolean;
  header: ReactNode;
  controls: ReactNode;
  table: ReactNode;
  pagination?: ReactNode;
  stripLegacyPaginationParams?: boolean;
}

export function InventoryPageShell({
  totalCount,
  currentPage,
  pageSize,
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
  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const tableShellRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);
  const usesViewportPagination =
    typeof totalCount === "number" &&
    typeof currentPage === "number" &&
    typeof pageSize === "number";

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

  useEffect(() => {
    if (!usesViewportPagination) {
      return;
    }

    const resolvedTotalCount = totalCount!;
    const resolvedCurrentPage = currentPage!;
    const resolvedPageSize = pageSize!;
    let frameId = 0;

    function syncPageSize() {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const shell = shellRef.current;
        const header = headerRef.current;
        const controls = controlsRef.current;
        const tableShell = tableShellRef.current;
        const paginationElement = paginationRef.current;

        if (!shell || !header || !controls || !tableShell) {
          return;
        }

        const tableElement = tableShell.querySelector("table");
        const tableHead = tableElement?.querySelector("thead");
        const headerHeight = tableHead
          ? Math.ceil(tableHead.getBoundingClientRect().height)
          : FALLBACK_HEADER_HEIGHT;
        const shellHeight = shell.clientHeight;
        const headerSectionHeight = Math.ceil(header.getBoundingClientRect().height);
        const controlsSectionHeight = Math.ceil(controls.getBoundingClientRect().height);
        const paginationHeight =
          showPagination && paginationElement
            ? Math.ceil(paginationElement.getBoundingClientRect().height)
            : 0;
        const availableRowArea = Math.max(
          0,
          shellHeight -
            headerSectionHeight -
            controlsSectionHeight -
            paginationHeight -
            headerHeight -
            2
        );
        const measuredPageSize = Math.max(
          1,
          Math.floor(availableRowArea / ESTIMATED_ROW_HEIGHT)
        );
        const nextPageSize =
          resolvedTotalCount > 0
            ? Math.min(resolvedTotalCount, measuredPageSize)
            : resolvedPageSize;
        const totalPages = Math.max(
          1,
          Math.ceil(Math.max(resolvedTotalCount, 1) / Math.max(nextPageSize, 1))
        );
        const nextPage = Math.min(resolvedCurrentPage, totalPages);

        if (nextPageSize === resolvedPageSize && nextPage === resolvedCurrentPage) {
          return;
        }

        const params = new URLSearchParams(searchParams.toString());
        params.set("pageSize", String(nextPageSize));

        if (nextPage <= 1) {
          params.delete("page");
        } else {
          params.set("page", String(nextPage));
        }

        const nextSearch = params.toString();
        router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, {
          scroll: false,
        });
      });
    }

    const shell = shellRef.current;
    const header = headerRef.current;
    const controls = controlsRef.current;
    const tableShell = tableShellRef.current;
    const paginationElement = paginationRef.current;

    if (!shell || !header || !controls || !tableShell) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => syncPageSize());
    resizeObserver.observe(shell);
    resizeObserver.observe(header);
    resizeObserver.observe(controls);
    resizeObserver.observe(tableShell);
    if (paginationElement) {
      resizeObserver.observe(paginationElement);
    }
    window.addEventListener("resize", syncPageSize);
    syncPageSize();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncPageSize);
    };
  }, [
    currentPage,
    pageSize,
    pathname,
    router,
    searchParams,
    showPagination,
    totalCount,
    usesViewportPagination,
  ]);

  return (
    <div
      className={`inventory-page-shell${
        usesViewportPagination ? " inventory-page-shell-paginated" : ""
      }`}
      ref={shellRef}
    >
      <div className="inventory-page-header-band">
        <div className="inventory-page-header" ref={headerRef}>
          {header}
        </div>
      </div>
      <div className="inventory-page-content-band">
        <div className="inventory-page-content">
          <div className="inventory-page-controls" ref={controlsRef}>
            <div className="inventory-page-controls-row">
              <div className="inventory-page-controls-main">{controls}</div>
              <div
                id={INVENTORY_BULK_DOCK_SLOT_ID}
                className="inventory-page-bulk-dock-slot"
              />
            </div>
          </div>
          <div className="inventory-page-table-area">
            <div className="inventory-page-table-shell" ref={tableShellRef}>
              {table}
            </div>
          </div>
          {showPagination ? (
            <div className="inventory-page-pagination" ref={paginationRef}>
              {pagination}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
