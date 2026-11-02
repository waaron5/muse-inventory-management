import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ToggleChip } from "@/components/filter-chip";
import { BackLink, PageHeader, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { qrCode } from "@/lib/qr";
import { loaders } from "@/server/loaders";
import { PrintButton, PrintSheets } from "../../print-sheets";

export const metadata: Metadata = { title: "Print list" };

export default function PrintPage({ params, searchParams }: PageProps<"/events/[id]/print">) {
  return (
    <Suspense fallback={<PrintSkeleton />}>
      <PrintList params={params} searchParams={searchParams} />
    </Suspense>
  );
}

// A working copy on paper: the Lines stay the record. On screen it's a
// preview with the order and the print button; printed, only the sheets.
async function PrintList({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const aToZ = query.order === "a-z";
  const [found, here] = await Promise.all([loaders.print(id, aToZ ? "a-z" : "by-location"), headers()]);
  if (!found) notFound();
  // The QR code opens the Event on whichever site printed it.
  const origin = `${here.get("x-forwarded-proto") ?? "http"}://${here.get("x-forwarded-host") ?? here.get("host")}`;

  return (
    <>
      <TopRow
        back={<BackLink href={`/events/${found.id}`}>{found.name}</BackLink>}
        action={<PrintButton />}
      />
      <PageColumn width="print">
        <div className="flex flex-col print:hidden">
          <PageHeader title="Print list">
            <div className="rail:hidden"><PrintButton /></div>
          </PageHeader>
          <div className="flex gap-2">
            <ToggleChip href={aToZ ? `/events/${found.id}/print` : `/events/${found.id}/print?order=a-z`} on={aToZ}>
              A–Z
            </ToggleChip>
          </div>
        </div>
        <div className="mt-6 rounded-lg bg-fill p-4 rail:p-7 print:m-0 print:rounded-none print:bg-transparent print:p-0">
            <PrintSheets
              event={{ name: found.name, client: found.client }}
              qr={qrCode(`${origin}/events/${found.id}`)}
              groups={found.groups}
            />
          </div>
      </PageColumn>
    </>
  );
}

function PrintSkeleton() {
  return (
    <>
      <TopRow />
      <PageColumn width="print" aria-hidden className="flex flex-col gap-8">
        <span className="h-8 w-64 rounded-md bg-fill" />
        <div className="h-32 rounded-md bg-fill" />
      </PageColumn>
    </>
  );
}
