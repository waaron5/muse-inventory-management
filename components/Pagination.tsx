"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface PaginationProps {
  total: number;
  pageSize: number;
  currentPage: number;
}

export function Pagination({ total, pageSize, currentPage }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  function goTo(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  // Build visible page numbers: always show first, last, current ± 1
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <>
      <div className="pagination">
        <button
          className="pg-btn"
          disabled={currentPage <= 1}
          onClick={() => goTo(currentPage - 1)}
        >
          ← Prev
        </button>

        <div className="pg-pages">
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="pg-ellipsis">…</span>
            ) : (
              <button
                key={p}
                className={`pg-btn pg-num ${p === currentPage ? "pg-active" : ""}`}
                onClick={() => goTo(p)}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          className="pg-btn"
          disabled={currentPage >= totalPages}
          onClick={() => goTo(currentPage + 1)}
        >
          Next →
        </button>

        <span className="pg-info">{total} total</span>
      </div>
    </>
  );
}
