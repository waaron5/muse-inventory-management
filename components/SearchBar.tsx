"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface SearchBarProps {
  placeholder?: string;
  paramName?: string;
}

export function SearchBar({
  placeholder = "Search…",
  paramName = "q",
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
      <div className="search-bar">
        <svg
          className="search-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          className="search-input"
          placeholder={placeholder}
          defaultValue={searchParams.get(paramName) ?? ""}
          onChange={handleChange}
        />
      </div>

      <style jsx>{`
        .search-bar {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 10px;
          color: #9ca3af;
          pointer-events: none;
          flex-shrink: 0;
        }
        .search-input {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 12px 8px 34px;
          font-size: 14px;
          width: 280px;
          outline: none;
          background: white;
          transition: border-color 0.15s;
        }
        .search-input:focus {
          border-color: #00b4d8;
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.1);
        }
        .search-input::placeholder {
          color: #9ca3af;
        }
      `}</style>
    </>
  );
}
