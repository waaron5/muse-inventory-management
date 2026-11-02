"use client";

import { CalendarBlank, Gift, Package } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/events", label: "Events", Icon: CalendarBlank },
  { href: "/inventory", label: "Inventory", Icon: Package },
  { href: "/gifts", label: "Gifts", Icon: Gift },
] as const;

type IsCurrent = (href: string) => boolean;

function useCurrent(): IsCurrent {
  const pathname = usePathname();
  return (href) => pathname === href || pathname.startsWith(`${href}/`);
}

// On a route whose id is only known at request time (an item page), the
// pathname suspends; the shell stays prerendered with nothing marked current
// until it streams in.
const noneCurrent: IsCurrent = () => false;

/**
 * The sidebar's sections: a labelled rail at 800–1023px, full rows from 1024px.
 * The current one's icon is filled, as in Dropbox; Lucide has no filled icons,
 * so these three are Phosphor's, outlined at rest.
 */
export function SideNav() {
  return (
    <Suspense fallback={<SideNavLinks isCurrent={noneCurrent} />}>
      <CurrentSideNav />
    </Suspense>
  );
}

function CurrentSideNav() {
  return <SideNavLinks isCurrent={useCurrent()} />;
}

function SideNavLinks({ isCurrent }: { isCurrent: IsCurrent }) {
  return (
    <nav className="flex w-full flex-col items-center gap-1 lg:items-stretch">
      {sections.map(({ href, label, Icon }) => {
        const current = isCurrent(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-[58px] w-[60px] flex-col items-center justify-center gap-0.5 rounded-md text-[12px] leading-[14px] text-ink hover:bg-hover",
              "lg:h-10 lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-[15px] lg:leading-6",
              current && "bg-selected font-medium hover:bg-selected",
            )}
          >
            <Icon
              size={20}
              weight={current ? "fill" : "regular"}
              aria-hidden
              className={current ? "text-ink" : "text-subtle"}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The phone top bar's sections, as underlined tabs. */
export function TopNav() {
  return (
    <Suspense fallback={<TopNavLinks isCurrent={noneCurrent} />}>
      <CurrentTopNav />
    </Suspense>
  );
}

function CurrentTopNav() {
  return <TopNavLinks isCurrent={useCurrent()} />;
}

function TopNavLinks({ isCurrent }: { isCurrent: IsCurrent }) {
  return (
    <nav className="flex gap-6">
      {sections.map(({ href, label }) => {
        const current = isCurrent(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-10 items-center font-medium text-subtle",
              current && "text-ink shadow-[inset_0_-2px_0_var(--ink)]",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
