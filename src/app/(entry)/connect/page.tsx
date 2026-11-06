import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntryCard, EntryHeading } from "@/components/entry";
import { aiConnectionsOn } from "@/lib/ai-connections";
import { asSearchParams } from "@/lib/search-params";
import { readConnecting } from "@/server/ai";
import { AllowForm } from "./allow-form";

export const metadata: Metadata = { title: "Connect an AI app" };

/**
 * The Allow screen (ADR 0017): an AI app asks to act as the signed-in person.
 * One choice, no scopes. The app named itself, so where it returns to is shown too.
 */
export default function ConnectPage({ searchParams }: PageProps<"/connect">) {
  return (
    <Suspense fallback={<EntryCard aria-busy className="min-h-72" />}>
      <AllowCard searchParams={searchParams} />
    </Suspense>
  );
}

async function AllowCard({ searchParams }: { searchParams: PageProps<"/connect">["searchParams"] }) {
  const params = asSearchParams(await searchParams);
  // Read as the request comes in, not when the app was built.
  if (!aiConnectionsOn()) notFound();
  const request = await readConnecting(params);

  if (!request) {
    return (
      <EntryCard>
        <EntryHeading>This link has expired</EntryHeading>
        <p className="mt-1 text-subtle">Go back to your AI app and connect to Muse Inventory again.</p>
      </EntryCard>
    );
  }

  return (
    <EntryCard>
      <EntryHeading>
        Let <span className="[overflow-wrap:anywhere]">{request.appName}</span> act as you in Muse Inventory?
      </EntryHeading>
      <p className="mt-2 mb-5 text-subtle">
        It can see everything you can and make the changes you can, except deleting, managing people, merging Clients, Acknowledging Shortages and photos.
      </p>
      <AllowForm request={params.toString()} />
      <p className="mt-5 text-center text-[14px] text-subtle">
        Either way, you&rsquo;ll go back to <strong className="font-semibold [overflow-wrap:anywhere]">{request.returnsTo}</strong>.
      </p>
    </EntryCard>
  );
}
