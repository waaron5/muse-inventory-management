import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, PageHeader, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { NewCatalogItem } from "../../_catalog/item-form-page";

export const metadata: Metadata = { title: "Add Item" };

export default function NewItemPage() {
  return (
    <>
      <TopRow back={<BackLink href="/inventory">Inventory</BackLink>} />
      <PageColumn width="form">
        <PageHeader title="Add Item" />
        <Suspense fallback={<div className="h-96 max-w-[560px] rounded-md bg-fill" />}>
          <NewCatalogItem kind="inventory" />
        </Suspense>
      </PageColumn>
    </>
  );
}
