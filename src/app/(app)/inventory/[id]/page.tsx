import type { Metadata } from "next";
import { BackLink, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { Suspense } from "react";
import { CatalogItem, ItemSkeleton } from "../../_catalog/catalog-item";

export const metadata: Metadata = { title: "Item" };

export default function ItemPage({ params }: PageProps<"/inventory/[id]">) {
  return (
    <>
      <TopRow back={<BackLink href="/inventory">Inventory</BackLink>} />
      <PageColumn>
        <Suspense fallback={<ItemSkeleton />}>
          <CatalogItem kind="inventory" params={params} />
        </Suspense>
      </PageColumn>
    </>
  );
}
