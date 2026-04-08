import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorageLocationNames } from "@/lib/storage-locations";
import { notFound, redirect } from "next/navigation";
import { InventoryForm } from "../../InventoryForm";

export default async function EditInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/inventory");

  const [item, locationOptions] = await Promise.all([
    prisma.inventoryItem.findUnique({ where: { id } }),
    getStorageLocationNames(),
  ]);
  if (!item) notFound();

  return (
    <InventoryForm
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
