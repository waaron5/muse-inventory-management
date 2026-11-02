import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { SearchButton } from "../global-search";
import { Account } from "./account";
import { Flash } from "./flash";
import { SideNav, TopNav } from "./nav";

/**
 * The prerendered app shell (ADR 0006): a 240px sidebar from 1024px, a 72px
 * labelled rail at 800–1023px, and a sticky top bar on phone. It never waits
 * on data; each page streams its own into Suspense. Paper gets none of it.
 */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell min-h-dvh print:block! rail:grid rail:grid-cols-[72px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* The logo sits in a row as tall as each page's TopRow, at the same
          top, so its middle lines up with search and the main button. */}
      <aside className="sticky top-0 hidden print:hidden! h-dvh flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar px-2 pt-5 pb-3.5 rail:flex lg:items-stretch lg:px-3 lg:pb-4">
        <div className="mb-4 flex h-11 items-center lg:mb-5 lg:px-3">
          <Link href="/events" aria-label="Muse, go to Events" className="logo w-[52px] lg:w-[92px]" />
        </div>
        <SideNav />
        <div className="mt-auto w-full">
          <Suspense fallback={<AccountPlaceholder />}>
            <Account />
          </Suspense>
        </div>
      </aside>

      <div className="app-content min-w-0">
        <header className="sticky top-0 z-10 border-b border-line bg-background pr-[max(16px,env(safe-area-inset-right))] pl-[max(16px,env(safe-area-inset-left))] pt-[env(safe-area-inset-top)] print:hidden rail:hidden">
          <div className="flex h-[52px] items-center">
            <Link href="/events" aria-label="Muse, go to Events" className="logo mr-auto w-[84px]" />
            <Suspense><SearchButton /></Suspense>
            <Suspense fallback={<span aria-hidden className="size-[30px] rounded-full bg-fill" />}>
              <Account compact />
            </Suspense>
          </div>
          <TopNav />
        </header>

        {/* Content spans the space beside the sidebar, with small margins.
            Each page starts with its TopRow. */}
        <main className="pt-3 pr-[max(16px,env(safe-area-inset-right))] pb-28 pl-[max(16px,env(safe-area-inset-left))] rail:px-8 rail:pt-5 print:p-0!">
          {children}
        </main>
      </div>
      <Suspense>
        <Flash />
      </Suspense>
    </div>
  );
}

// Holds the account row's place while the session streams in.
function AccountPlaceholder() {
  return (
    <div aria-hidden className="flex items-center justify-center gap-2.5 p-1.5 lg:justify-start lg:p-2">
      <span className="size-8 shrink-0 rounded-full bg-fill" />
      <span className="hidden flex-1 flex-col gap-1.5 lg:flex">
        <span className="h-3 w-24 rounded-sm bg-fill" />
        <span className="h-2.5 w-12 rounded-sm bg-fill" />
      </span>
    </div>
  );
}
