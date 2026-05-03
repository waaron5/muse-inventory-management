"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface RowAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "danger" | "success";
  disabled?: boolean;
}

export function RowActionsMenu({
  actions,
  triggerLabel,
}: {
  actions: RowAction[];
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="row-actions-menu" ref={containerRef}>
      <button
        type="button"
        className="row-actions-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <DotsIcon />
      </button>

      {open && (
        <div className="row-actions-dropdown" role="menu">
          {actions.map((action, i) => {
            const cls = [
              "row-actions-item",
              action.variant === "danger" && "row-actions-item-danger",
              action.variant === "success" && "row-actions-item-success",
            ]
              .filter(Boolean)
              .join(" ");

            if (action.href) {
              return (
                <Link
                  key={i}
                  href={action.href}
                  className={cls}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {action.label}
                </Link>
              );
            }

            return (
              <button
                key={i}
                type="button"
                className={cls}
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onClick?.();
                }}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DotsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}
