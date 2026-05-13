import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { InventoryDetailClient } from "../InventoryDetailClient";
import { getInventoryDetailData } from "../detail-data";

export default async function EditInventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (session?.user.role !== "ADMIN") redirect(`/inventory/${id}`);

  const data = await getInventoryDetailData(id);
  if (!data) notFound();

  return <InventoryDetailClient data={data} isAdmin userId={session.user.id} initialEditing />;
}
