import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InventoryForm } from "../InventoryForm";

export default async function NewInventoryPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/inventory");

  return <InventoryForm mode="create" />;
}
