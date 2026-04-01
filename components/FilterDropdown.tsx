"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterDropdownProps {
  options: FilterOption[];
  paramName?: string;
  defaultLabel?: string;
}

export function FilterDropdown({
  options,
  paramName = "filter",
  defaultLabel = "All Items",
}: FilterDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get(paramName) ?? "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      const value = e.target.value;
      if (value) {
        params.set(paramName, value);
      } else {
        params.delete(paramName);
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, paramName]
  );

  return (
    <>
      <div className="filter-wrapper">
        <select
          className="filter-select"
          value={current}
          onChange={handleChange}
        >
          <option value="">{defaultLabel}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          className="filter-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <style jsx>{`
        .filter-wrapper {
          position: relative;
          display: inline-flex;
          align-items: center;
        }
        .filter-select {
          appearance: none;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 32px 8px 12px;
          font-size: 14px;
          background: white;
          color: #374151;
          cursor: pointer;
          outline: none;
          transition: border-color 0.15s;
          min-width: 130px;
        }
        .filter-select:focus {
          border-color: #00b4d8;
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.1);
        }
        .filter-chevron {
          position: absolute;
          right: 10px;
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </>
  );
}
