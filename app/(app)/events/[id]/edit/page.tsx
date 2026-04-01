import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { EventForm } from "../../EventForm";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect(`/events/${id}`);

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  return (
    <EventForm
      mode="edit"
      event={{
        id: event.id,
        companyName: event.companyName,
        eventName: event.eventName,
        location: event.location,
        startDate: event.startDate.toISOString().split("T")[0],
        endDate: event.endDate.toISOString().split("T")[0],
        notes: event.notes ?? "",
      }}
    />
  );
}
