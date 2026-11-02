import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, PageHeader, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { NewCatalogItem } from "../../_catalog/item-form-page";

export const metadata: Metadata = { title: "Add Gift" };

export default function NewGiftPage() {
  return (
    <>
      <TopRow back={<BackLink href="/gifts">Gifts</BackLink>} />
      <PageColumn width="form">
        <PageHeader title="Add Gift" />
        <Suspense fallback={<div className="h-96 max-w-[560px] rounded-md bg-fill" />}>
          <NewCatalogItem kind="gift" />
        </Suspense>
      </PageColumn>
    </>
  );
}
