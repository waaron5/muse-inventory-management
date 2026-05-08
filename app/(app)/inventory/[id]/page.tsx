import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getInventoryDetailData } from "./detail-data";
import { InventoryDetailClient } from "./InventoryDetailClient";

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const data = await getInventoryDetailData(id);

  if (!data) notFound();

  return (
    <InventoryDetailClient
      data={data}
      isAdmin={session?.user.role === "ADMIN"}
      userId={session?.user.id ?? ""}
    />
  );
}
