"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

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
  disabled = false,
}: {
  actions: RowAction[];
  triggerLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
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

  useLayoutEffect(() => {
    if (!open) {
      setDropdownStyle(null);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      const dropdown = dropdownRef.current;
      if (!trigger || !dropdown) return;

      const triggerRect = trigger.getBoundingClientRect();
      const dropdownRect = dropdown.getBoundingClientRect();
      const viewportPadding = 8;
      const offset = 4;

      let left = triggerRect.right - dropdownRect.width;
      left = Math.max(
        viewportPadding,
        Math.min(left, window.innerWidth - dropdownRect.width - viewportPadding),
      );

      let top = triggerRect.bottom + offset;
      if (top + dropdownRect.height > window.innerHeight - viewportPadding) {
        top = Math.max(viewportPadding, triggerRect.top - dropdownRect.height - offset);
      }

      setDropdownStyle({
        top: Math.round(top),
        left: Math.round(left),
        minWidth: Math.max(Math.round(triggerRect.width), 140),
        visibility: "visible",
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <div className="row-actions-menu" ref={containerRef}>
        <button
          ref={triggerRef}
          type="button"
          className="row-actions-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={triggerLabel}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
        >
          <DotsIcon />
        </button>
      </div>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            className="row-actions-dropdown"
            role="menu"
            style={
              dropdownStyle ?? {
                top: 0,
                left: 0,
                minWidth: 140,
                visibility: "hidden",
              }
            }
          >
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
          </div>,
          document.body,
        )}
    </>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}
