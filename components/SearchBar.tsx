"use client";

import { useCallback, useRef } from "react";
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const value = e.target.value;
      timerRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
          params.set(paramName, value);
        } else {
          params.delete(paramName);
        }
        params.delete("page");
        router.replace(`${pathname}?${params.toString()}`);
      }, 300);
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
    </>
  );
}
