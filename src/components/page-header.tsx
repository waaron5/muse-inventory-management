import { Settings } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "./global-search";
import { HoverLabel } from "./hover-label";

export function PageTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <h1
      className={cn(
        "min-w-0 font-heading text-[24px] leading-8 font-medium tracking-[-0.01em] text-balance rail:text-[30px] rail:leading-[38px]",
        className,
      )}
    >
      {children}
    </h1>
  );
}

/** A form's or detail page's title, with a line of what it shows beneath it if needed, and its action. */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <PageTitle>{title}</PageTitle>
        {subtitle && <p className="text-subtle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * The first row of every page, as tall as the sidebar's logo row and lined up
 * with it. From 800px: the way back on the left (a detail or form page's),
 * then search and the page's main action on the right. On phone search is in
 * the top bar, so the row shows only the way back, if there is one.
 */
export function TopRow({ back, action, search = false }: { back?: ReactNode; action?: ReactNode; search?: boolean }) {
  return (
    <div className={cn("page-top-row mb-4 flex min-h-11 items-center gap-3 print:hidden rail:mb-6", !back && "hidden rail:flex")}>
      <div className="min-w-0 flex-1">{back}</div>
      {search && <div className="hidden w-80 rail:block">
        <GlobalSearch />
      </div>}
      {action && <div className="hidden rail:block">{action}</div>}
    </div>
  );
}

/** The way back from a detail or form page: "‹ Events", "‹ BRL Cove 26". */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-11 max-w-full items-center text-cyan-ink hover:underline">
      <span className="truncate">‹ {children}</span>
    </Link>
  );
}

/**
 * A list page's header: from 800px its main action shares the TopRow with
 * search, as in Dropbox, and the title comes below; on phone the title comes
 * first, with its action beside it. A gear beside the title, as in Dropbox,
 * goes to the page's part of Settings.
 */
export function ListHeader({
  title,
  action,
  team,
  settings,
}: {
  title: string;
  action: ReactNode;
  team?: ReactNode;
  settings: { href: string; label: string };
}) {
  return (
    <>
      <TopRow action={action} search />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <PageTitle>{title}</PageTitle>
          <HoverLabel label={settings.label}>
            <Link
              href={settings.href}
              aria-label={settings.label}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-subtle hover:text-foreground"
            >
              <Settings size={20} strokeWidth={1.75} aria-hidden />
            </Link>
          </HoverLabel>
        </div>
        {team}
        <div className="rail:hidden">{action}</div>
      </div>
    </>
  );
}
