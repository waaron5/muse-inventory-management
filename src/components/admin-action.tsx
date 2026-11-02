import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { currentSession } from "@/server/auth";
import { AskAnAdmin } from "./ask-an-admin";
import { ButtonLabel, buttonClass } from "./button";

/**
 * A page action only an Admin may take. A User sees it disabled with "Ask an
 * Admin" (Admin vs User permissions), never hidden. A main one carries an icon.
 */
export async function AdminAction({
  href,
  children,
  ...look
}: { href: string; children: string } & (
  | { variant?: "main"; icon: LucideIcon }
  | { variant: "secondary"; icon?: LucideIcon }
)) {
  const session = await currentSession();
  const variant = look.variant ?? "main";
  if (session?.user.role !== "admin") {
    return (
      <AskAnAdmin look={variant} icon={look.icon}>
        {children}
      </AskAnAdmin>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant)}>
      <ButtonLabel icon={look.icon}>{children}</ButtonLabel>
    </Link>
  );
}
