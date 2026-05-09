import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { EventDetailClient } from "../EventDetailClient";
import { getEventDetailData } from "../detail-data";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (session?.user.role !== "ADMIN") redirect(`/events/${id}`);

  const data = await getEventDetailData(id, session.user.id);
  if (!data) notFound();

  return (
    <EventDetailClient
      data={data}
      isAdmin
      userId={session.user.id}
      initialEditing
      returnToCanonicalOnExit
    />
  );
}
