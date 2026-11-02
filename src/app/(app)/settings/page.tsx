import type { Metadata } from "next";
import { Suspense } from "react";
import { TopRow } from "@/components/page-header";
import { RowListSkeleton } from "@/components/row-list";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { SettingsCards } from "./sections";
import { SettingsNav } from "./settings-nav";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <>
    <TopRow />
    {/* From 1024px the heading and menu share a fixed column at the content's
        left edge. The cards stay centred on the page while there's room
        beside it, then take what's left. */}
    <div className="lg:grid lg:grid-cols-[minmax(160px,1fr)_minmax(0,760px)_minmax(0,1fr)] lg:gap-6">
      <SettingsNav />
      <div className="w-full rail:mx-auto rail:max-w-[760px] lg:pt-[62px]">
        <Suspense fallback={<RowListSkeleton />}><SettingsCards /></Suspense>
        {/* A gear on a list page links here to its section (#clients, #locations). */}
        <ScrollToHash />
      </div>
    </div>
  </>;
}
