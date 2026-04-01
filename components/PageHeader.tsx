"use client";

import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {action && <div className="page-header-action">{action}</div>}
      </div>

      <style jsx>{`
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
        }
        .page-header-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .page-title {
          font-size: 28px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          line-height: 1.2;
        }
        .page-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }
        .page-header-action {
          flex-shrink: 0;
          margin-top: 4px;
        }
      `}</style>
    </>
  );
}
