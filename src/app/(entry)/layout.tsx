import { InventoryLogo } from "@/components/inventory-logo";
import { PageColumn } from "@/components/page-column";

/** Sign-in and the first-sign-in name prompt: one narrow bordered column, logo inside, centred on screen, no shell. */
export default function EntryLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-4 pt-[max(48px,env(safe-area-inset-top))] pb-[max(48px,env(safe-area-inset-bottom))] rail:px-0">
      <PageColumn width="compact">
        <div className="mb-10 flex items-baseline justify-center gap-2.5">
          <span aria-hidden className="logo w-[104px]" />
          <InventoryLogo className="text-[34px]" />
        </div>
        {children}
      </PageColumn>
    </main>
  );
}
