import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { EditEvent } from "../../event-form-page";

export const metadata: Metadata = { title: "Edit Event" };

export default function EditEventPage({ params, searchParams }: PageProps<"/events/[id]/edit">) {
  return (
    // The way back names what's being edited, so the top row streams in with it.
    <Suspense
      fallback={
        <>
          <TopRow />
          <PageColumn width="form">
            <PageHeader title="Edit Event" />
            <div className="h-96 max-w-[560px] rounded-md bg-fill" />
          </PageColumn>
        </>
      }
    >
      <EditEvent title="Edit Event" params={params} searchParams={searchParams} />
    </Suspense>
  );
}
