import type { Metadata } from "next";
import { BackLink, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { Suspense } from "react";
import { CatalogItem, ItemSkeleton } from "../../_catalog/catalog-item";

export const metadata: Metadata = { title: "Gift" };

export default function GiftPage({ params }: PageProps<"/gifts/[id]">) {
  return (
    <>
      <TopRow back={<BackLink href="/gifts">Gifts</BackLink>} />
      <PageColumn>
        <Suspense fallback={<ItemSkeleton />}>
          <CatalogItem kind="gift" params={params} />
        </Suspense>
      </PageColumn>
    </>
  );
}
