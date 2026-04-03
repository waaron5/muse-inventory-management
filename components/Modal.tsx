"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  headerContent?: React.ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
  titleClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  headerContent,
  headerClassName,
  bodyClassName,
  titleClassName,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();

      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    // Focus the first focusable element when the modal opens
    const timer = setTimeout(() => {
      if (panelRef.current) {
        const first = panelRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        first?.focus();
      }
    }, 0);

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeMap = { sm: "400px", md: "560px", lg: "720px" };

  return createPortal(
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="modal-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{ maxWidth: sizeMap[size] }}
      >
        <div className={`modal-header${headerClassName ? ` ${headerClassName}` : ""}`}>
          <div className="modal-header-copy">
            <h2 id="modal-title" className={`modal-title${titleClassName ? ` ${titleClassName}` : ""}`}>
              {title}
            </h2>
            {headerContent}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={`modal-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
