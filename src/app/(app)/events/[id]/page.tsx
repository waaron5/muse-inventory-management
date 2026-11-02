import { Printer } from "lucide-react";
import { ButtonLink } from "@/components/button";
import { Badge } from "@/components/badge";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BackLink, PageTitle, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { WarningPanel } from "@/components/warning-panel";
import { formatDays, formatPrice, formatShort } from "@/lib/format";
import { currentSession } from "@/server/auth";
import { loaders } from "@/server/loaders";
import { ClientTag } from "../client-tag";
import { EventLines } from "../event-lines";
import { EventMenu } from "../event-menu";
import { ShortageButton } from "../shortage";

export const metadata: Metadata = { title: "Event" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <>
      <TopRow back={<BackLink href="/events">Events</BackLink>} />
      <PageColumn>
        <Suspense fallback={<EventSkeleton />}>
          <EventDetail params={params} />
        </Suspense>
      </PageColumn>
    </>
  );
}

// One scroll, no tabs: the header, Inventory, Gifts, then Notes.
async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const [found, session] = await Promise.all([loaders.event(id), currentSession()]);
  if (!found) notFound();
  const isAdmin = session?.user.role === "admin";
  const flagged = found.shortages.filter((s) => s.flagged);
  const hasLines = found.inventory.length + found.gifts.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className={`client-${found.client.colour} flex flex-col gap-3 border-l-4 border-(--client-accent) pl-4`}>
        <div className="flex items-start gap-3">
          <PageTitle className="flex-1">{found.name}</PageTitle>
          <EventMenu event={{ ...found, hasLines }} isAdmin={isAdmin} />
        </div>
        <ClientTag client={found.client} className="self-start" />
        <div className="flex flex-wrap items-center gap-3">
          <dl className="grid flex-1 grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
            <dt className="text-subtle">Dates</dt>
            <dd>{formatDays(found.startsOn, found.endsOn)}</dd>
            {found.venue && (
              <>
                <dt className="text-subtle">Venue</dt>
                <dd>{found.venue}</dd>
              </>
            )}
            {found.plCode && (
              <>
                <dt className="text-subtle">P&L Code</dt>
                <dd>{found.plCode}</dd>
              </>
            )}
          </dl>
          <ButtonLink look="main" icon={Printer} href={`/events/${found.id}/print`}>Print / PDF</ButtonLink>
        </div>
        {hasLines && (
          <p>
            Gear and gifts reserved: <span className="font-medium tabular-nums">{formatPrice(found.reservedCents)}</span>
          </p>
        )}
        {found.cancelled && <Badge tone="plain" className="self-start">Cancelled</Badge>}
        {flagged.length > 0 && (
          <WarningPanel>
            <ul aria-label="Warnings" className="flex flex-col gap-1">
              {flagged.map((s) => (
                <li key={s.item.id}>
                  <ShortageButton
                    eventId={found.id}
                    shortage={s}
                    isAdmin={isAdmin}
                    className="text-left font-medium hover:underline"
                  >
                    {formatShort(s.shortBy)} · {s.item.name}
                  </ShortageButton>
                </li>
              ))}
            </ul>
          </WarningPanel>
        )}
      </header>

      <EventLines event={found} isAdmin={isAdmin} />

      {found.notes && <section className="flex flex-col gap-3">
        <h2 className="font-heading text-[18px] leading-6 font-medium">Notes</h2>
        <p className="whitespace-pre-line">{found.notes}</p>
      </section>}
    </div>
  );
}

function EventSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <span className="h-8 w-64 rounded-md bg-fill" />
      <div className="h-32 rounded-md bg-fill" />
    </div>
  );
}
