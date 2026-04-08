import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorageLocationNames } from "@/lib/storage-locations";
import { notFound, redirect } from "next/navigation";
import { GiftForm } from "../../GiftForm";

export default async function EditGiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect(`/gifting/${id}`);

  const [item, locationOptions] = await Promise.all([
    prisma.giftItem.findUnique({ where: { id } }),
    getStorageLocationNames(),
  ]);
  if (!item) notFound();

  return (
    <GiftForm
      locationOptions={locationOptions}
      mode="edit"
      item={{
        id: item.id,
        title: item.title,
        description: item.description ?? "",
        imageUrl: item.imageUrl ?? "",
        quantity: item.quantity,
        currentLocation: item.currentLocation ?? "",
        notes: item.notes ?? "",
      }}
    />
  );
}
