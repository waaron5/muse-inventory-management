import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/button";
import { ListHeader } from "@/components/page-header";
import { ListPage } from "@/components/list-page";
import { EventsList, EventsSkeleton } from "./events-list";
import { Team } from "./team";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <ListPage>
      <ListHeader
        title="Events"
        settings={{ href: "/settings#clients", label: "Client settings" }}
        team={<Suspense><Team /></Suspense>}
        action={
          <ButtonLink look="main" icon={Plus} href="/events/new">
            Add Event
          </ButtonLink>
        }
      />
      <Suspense fallback={<EventsSkeleton />}>
        <EventsList searchParams={searchParams} />
      </Suspense>
    </ListPage>
  );
}
