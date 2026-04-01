import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GiftForm } from "../GiftForm";

export default async function NewGiftPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/gifting");

  return <GiftForm mode="create" />;
}
