"use client";

import { type ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </div>
  );
}
