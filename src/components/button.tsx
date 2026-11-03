import { type LucideIcon, Plus } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// The buttons the screens share. A main button is Muse cyan and always
// carries an icon; sections use the same treatment. Sign-in's card is the
// one exception, with words only (components/entry.tsx).

export const buttonLook = {
  main: "main-action bg-main text-on-main hover:bg-main-hover",
  secondary: "border border-line bg-background hover:bg-hover",
  plain: "hover:bg-hover",
};

export type ButtonLook = keyof typeof buttonLook;

const shape =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md px-4 font-heading font-medium disabled:opacity-60";

export function buttonClass(look: ButtonLook, className?: string) {
  return cn(shape, buttonLook[look], className);
}

/** A button's icon and words. */
export function ButtonLabel({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <>
      {Icon && <Icon size={18} strokeWidth={1.75} aria-hidden className={cn("-ml-0.5", Icon === Plus && "add-icon")} />}
      {children}
    </>
  );
}

export function MainButton({ icon, children, className, ...button }: ComponentProps<"button"> & { icon: LucideIcon }) {
  return (
    <button className={buttonClass("main", className)} {...button}>
      <ButtonLabel icon={icon}>{children}</ButtonLabel>
    </button>
  );
}

export function SecondaryButton({ className, ...button }: ComponentProps<"button">) {
  return <button className={buttonClass("secondary", className)} {...button} />;
}

/** A quiet section action: icon and text, without a filled background. */
export function TextButton({ icon, children, className, ...button }: ComponentProps<"button"> & { icon: LucideIcon }) {
  return (
    <button className={cn(shape, "px-0 hover:underline underline-offset-4", className)} {...button}>
      <ButtonLabel icon={icon}>{children}</ButtonLabel>
    </button>
  );
}

/** Form and confirmation actions share one right-aligned footer. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-wrap items-center justify-end gap-3">{children}</div>;
}

/** A link that looks like a button: a main one needs its icon. */
export function ButtonLink({
  look,
  icon,
  children,
  className,
  ...link
}: ComponentProps<typeof Link> &
  ({ look: "main"; icon: LucideIcon } | { look: Exclude<ButtonLook, "main">; icon?: LucideIcon })) {
  return (
    <Link className={buttonClass(look, className)} {...link}>
      <ButtonLabel icon={icon}>{children}</ButtonLabel>
    </Link>
  );
}
