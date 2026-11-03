import { InventoryLogo } from "@/components/inventory-logo";
import { MuseWordmark } from "@/components/muse-wordmark";

/**
 * Sign-in and the first-sign-in name prompt, with no shell: a Muse purple
 * bubble holding the logo, "inventory" written in beneath it, and the
 * floating card beside it, or below it on a phone.
 */
export default function EntryLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="entry">
      <div aria-hidden className="entry-bubble" />
      <div className="entry-brand">
        <MuseWordmark className="w-[148px] rail:w-[208px]" />
        <InventoryLogo className="mt-1 text-[38px] rail:mt-2 rail:text-[52px]" />
        <span className="sr-only">Muse Inventory</span>
      </div>
      <div className="entry-panel">{children}</div>
    </main>
  );
}
