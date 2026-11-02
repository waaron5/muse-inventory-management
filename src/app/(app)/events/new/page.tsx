import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, PageHeader, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { NewEvent } from "../event-form-page";

export const metadata: Metadata = { title: "Add Event" };

export default function NewEventPage() {
  return (
    <>
      <TopRow back={<BackLink href="/events">Events</BackLink>} />
      <PageColumn width="form">
        <PageHeader title="Add Event" />
        <Suspense fallback={<div className="h-96 max-w-[560px] rounded-md bg-fill" />}>
          <NewEvent />
        </Suspense>
      </PageColumn>
    </>
  );
}
