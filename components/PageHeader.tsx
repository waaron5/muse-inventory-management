"use client";

import { type ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  action?: ReactNode;
  actionPlacement?: "inline" | "below";
}

export function PageHeader({
  title,
  action,
  actionPlacement = "inline",
}: PageHeaderProps) {
  const showActionBelowTitle = action && actionPlacement === "below";

  return (
    <>
      <div
        className={`page-header${
          showActionBelowTitle ? " page-header-action-below-title" : ""
        }`}
      >
        <div className="page-header-text">
          <h1 className="page-title">{title}</h1>
          {showActionBelowTitle ? (
            <div className="page-header-action page-header-action-under-title">
              {action}
            </div>
          ) : null}
        </div>
        {!showActionBelowTitle && action ? (
          <div className="page-header-action">{action}</div>
        ) : null}
      </div>
    </>
  );
}
