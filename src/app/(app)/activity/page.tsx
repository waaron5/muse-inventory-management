import type { Metadata } from "next";
import { Suspense } from "react";
import { PageColumn } from "@/components/page-column";
import { PageHeader, TopRow } from "@/components/page-header";
import { RowListSkeleton } from "@/components/row-list";
import { ActivityList } from "./activity-list";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage({ searchParams }: PageProps<"/activity">) {
  return <>
    <TopRow />
    <PageColumn>
      <PageHeader title="Activity" />
      <Suspense fallback={<RowListSkeleton />}><ActivityList searchParams={searchParams} /></Suspense>
    </PageColumn>
  </>;
}
