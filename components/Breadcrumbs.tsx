import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol className="bc-list">
          {items.map((crumb, i) => (
            <li key={i} className="bc-item">
              {i > 0 && <span className="bc-sep">/</span>}
              {crumb.href && i < items.length - 1 ? (
                <Link href={crumb.href} className="bc-link">
                  {crumb.label}
                </Link>
              ) : (
                <span className="bc-current">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
