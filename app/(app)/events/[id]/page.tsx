import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { EventDetailClient } from "./EventDetailClient";
import { getEventDetailData } from "./detail-data";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const data = await getEventDetailData(id, session?.user.id ?? "");

  if (!data) notFound();

  return (
    <EventDetailClient
      data={data}
      isAdmin={session?.user.role === "ADMIN"}
      userId={session?.user.id ?? ""}
    />
  );
}
