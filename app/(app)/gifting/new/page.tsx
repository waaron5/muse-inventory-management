import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStorageLocationNames } from "@/lib/storage-locations";
import { redirect } from "next/navigation";
import { GiftForm } from "../GiftForm";

export default async function NewGiftPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/gifting");
  const locationOptions = await getStorageLocationNames();

  return (
    <div className="create-form-page">
      <GiftForm locationOptions={locationOptions} mode="create" />
    </div>
  );
}
