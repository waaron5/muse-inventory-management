import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BackLink, PageHeader, TopRow } from "@/components/page-header";
import { PageColumn } from "@/components/page-column";
import { safeBack } from "@/lib/back-to";
import { loaders } from "@/server/loaders";
import { createEvent, editEvent } from "./actions";
import { EventForm } from "./event-form";

/** Planning a new Event. */
export async function NewEvent() {
  await connection();
  const { clients } = await loaders.events({});
  return <EventForm action={createEvent} clients={clients} cancelHref="/events" />;
}

/** Changing an Event's details; anyone can change any Event. */
export async function EditEvent({
  title,
  params,
  searchParams,
}: {
  title: string;
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string | string[] }>;
}) {
  await connection();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // Opened from a row's "⋯", saving and cancelling go back to that list.
  const back = safeBack(typeof query.back === "string" ? query.back : undefined);
  const [found, { clients }] = await Promise.all([loaders.event(id), loaders.events({})]);
  if (!found) notFound();
  return (
    <>
      <TopRow back={<BackLink href={`/events/${found.id}`}>{found.name}</BackLink>} />
      <PageColumn width="form">
        <PageHeader title={title} />
        <EventForm
          action={editEvent}
          event={{
            id: found.id,
            name: found.name,
            client: found.client.name,
            plCode: found.plCode ?? "",
            venue: found.venue ?? "",
            startsOn: found.startsOn ?? "",
            endsOn: found.endsOn ?? "",
            notes: found.notes ?? "",
          }}
          clients={clients}
          cancelHref={back ?? `/events/${found.id}`}
          back={back}
        />
      </PageColumn>
    </>
  );
}
