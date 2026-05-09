import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { GiftDetailClient } from "./GiftDetailClient";
import { getGiftDetailData } from "./detail-data";

export default async function GiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const data = await getGiftDetailData(id);

  if (!data) notFound();

  return (
    <GiftDetailClient
      data={data}
      isAdmin={session?.user.role === "ADMIN"}
      userId={session?.user.id ?? ""}
    />
  );
}
