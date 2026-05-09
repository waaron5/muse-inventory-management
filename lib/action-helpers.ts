import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}
