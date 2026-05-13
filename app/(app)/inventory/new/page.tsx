import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStorageLocationNames } from "@/lib/storage-locations";
import { redirect } from "next/navigation";
import { InventoryForm } from "../InventoryForm";

export default async function NewInventoryPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/inventory");
  const locationOptions = await getStorageLocationNames();

  return (
    <div className="create-form-page">
      <InventoryForm locationOptions={locationOptions} mode="create" />
    </div>
  );
}
