import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ButtonLabel, type ButtonLook, buttonClass } from "./button";

/**
 * What a User sees in place of an action only an Admin may take: the action
 * disabled, with "Ask an Admin" (Admin vs User permissions), never hidden.
 */
export function AskAnAdmin({
  look,
  icon,
  children,
  className,
}: {
  look: ButtonLook;
  icon?: LucideIcon;
  children: string;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-col items-end gap-0.5", className)}>
      <button disabled className={buttonClass(look)}>
        <ButtonLabel icon={icon}>{children}</ButtonLabel>
      </button>
      <span className="text-[13px] text-subtle">Ask an Admin</span>
    </span>
  );
}
