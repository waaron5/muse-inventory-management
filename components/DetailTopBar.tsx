"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { useSetTopBar } from "@/components/TopBarContext";
import type { Crumb } from "@/components/Breadcrumbs";

export function DetailTopBar({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  const titleNode = (
    <ol className="bc-list" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <li key={i} className="bc-item">
          {i > 0 && <span className="bc-sep" aria-hidden="true">/</span>}
          {crumb.href && i < crumbs.length - 1 ? (
            <Link href={crumb.href} className="bc-link">
              {crumb.label}
            </Link>
          ) : (
            <span className="bc-current">{crumb.label}</span>
          )}
        </li>
      ))}
    </ol>
  );

  useSetTopBar(titleNode, actions ?? null);
  return null;
}
