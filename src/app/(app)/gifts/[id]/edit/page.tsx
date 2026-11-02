import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { EditCatalogItem } from "../../../_catalog/item-form-page";

export const metadata: Metadata = { title: "Edit Gift" };

export default function EditGiftPage({ params, searchParams }: PageProps<"/gifts/[id]/edit">) {
  return (
    // The way back names what's being edited, so the top row streams in with it.
    <Suspense
      fallback={
        <>
          <TopRow />
          <PageColumn width="form">
            <PageHeader title="Edit Gift" />
            <div className="h-96 max-w-[560px] rounded-md bg-fill" />
          </PageColumn>
        </>
      }
    >
      <EditCatalogItem title="Edit Gift" kind="gift" params={params} searchParams={searchParams} />
    </Suspense>
  );
}
