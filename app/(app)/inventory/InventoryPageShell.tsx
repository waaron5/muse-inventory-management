"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const FALLBACK_ROW_HEIGHT = 88;
const FALLBACK_HEADER_HEIGHT = 45;

interface InventoryPageShellProps {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  showPagination: boolean;
  header: ReactNode;
  controls: ReactNode;
  table: ReactNode;
  pagination: ReactNode;
}

export function InventoryPageShell({
  totalCount,
  currentPage,
  pageSize,
  showPagination,
  header,
  controls,
  table,
  pagination,
}: InventoryPageShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const tableShellRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frameId = 0;

    function syncPageSize() {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const shell = shellRef.current;
        const header = headerRef.current;
        const controls = controlsRef.current;
        const tableShell = tableShellRef.current;
        const pagination = paginationRef.current;

        if (!shell || !header || !controls || !tableShell) {
          return;
        }

        const tableElement = tableShell.querySelector("table");
        const tableHead = tableElement?.querySelector("thead");
        const rowElements = Array.from(
          tableElement?.querySelectorAll<HTMLTableRowElement>("tbody tr.table-row") ?? []
        );
        const rowHeight =
          rowElements.length > 0
            ? Math.max(
                ...rowElements.map((row) => Math.ceil(row.getBoundingClientRect().height))
              )
            : FALLBACK_ROW_HEIGHT;
        const headerHeight = tableHead
          ? Math.ceil(tableHead.getBoundingClientRect().height)
          : FALLBACK_HEADER_HEIGHT;
        const shellHeight = shell.clientHeight;
        const headerSectionHeight = Math.ceil(header.getBoundingClientRect().height);
        const controlsSectionHeight = Math.ceil(controls.getBoundingClientRect().height);
        const paginationHeight =
          showPagination && pagination
            ? Math.ceil(pagination.getBoundingClientRect().height)
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
          Math.floor(availableRowArea / Math.max(rowHeight, 1))
        );
        const nextPageSize = totalCount > 0 ? Math.min(totalCount, measuredPageSize) : pageSize;
        const totalPages = Math.max(
          1,
          Math.ceil(Math.max(totalCount, 1) / Math.max(nextPageSize, 1))
        );
        const nextPage = Math.min(currentPage, totalPages);

        if (nextPageSize === pageSize && nextPage === currentPage) {
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
    const pagination = paginationRef.current;

    if (!shell || !header || !controls || !tableShell) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => syncPageSize());
    resizeObserver.observe(shell);
    resizeObserver.observe(header);
    resizeObserver.observe(controls);
    resizeObserver.observe(tableShell);
    if (pagination) {
      resizeObserver.observe(pagination);
    }
    window.addEventListener("resize", syncPageSize);
    syncPageSize();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncPageSize);
    };
  }, [currentPage, pageSize, pathname, router, searchParams, showPagination, totalCount]);

  return (
    <div className="inventory-page-shell" ref={shellRef}>
      <div className="inventory-page-header" ref={headerRef}>
        {header}
      </div>
      <div className="inventory-page-controls" ref={controlsRef}>
        {controls}
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
  );
}
