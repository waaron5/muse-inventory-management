import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { EditCatalogItem } from "../../../_catalog/item-form-page";

export const metadata: Metadata = { title: "Edit item" };

export default function EditItemPage({ params, searchParams }: PageProps<"/inventory/[id]/edit">) {
  return (
    // The way back names what's being edited, so the top row streams in with it.
    <Suspense
      fallback={
        <>
          <TopRow />
          <PageColumn width="form">
            <PageHeader title="Edit item" />
            <div className="h-96 max-w-[560px] rounded-md bg-fill" />
          </PageColumn>
        </>
      }
    >
      <EditCatalogItem title="Edit item" kind="inventory" params={params} searchParams={searchParams} />
    </Suspense>
  );
}
