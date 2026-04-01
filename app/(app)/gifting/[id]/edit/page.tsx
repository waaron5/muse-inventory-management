import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { GiftForm } from "../../GiftForm";

export default async function EditGiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect(`/gifting/${id}`);

  const item = await prisma.giftItem.findUnique({ where: { id } });
  if (!item) notFound();

  return (
    <GiftForm
      mode="edit"
      item={{
        id: item.id,
        title: item.title,
        description: item.description ?? "",
        imageUrl: item.imageUrl ?? "",
        quantity: item.quantity,
        notes: item.notes ?? "",
      }}
    />
  );
}
