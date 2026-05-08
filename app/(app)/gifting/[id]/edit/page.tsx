import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { GiftDetailClient } from "../GiftDetailClient";
import { getGiftDetailData } from "../detail-data";

export default async function EditGiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (session?.user.role !== "ADMIN") redirect(`/gifting/${id}`);

  const data = await getGiftDetailData(id);
  if (!data) notFound();

  return (
    <GiftDetailClient
      data={data}
      isAdmin
      userId={session.user.id}
      initialEditing
      returnToCanonicalOnExit
    />
  );
}
