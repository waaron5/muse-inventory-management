import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { buttonClass } from "./button";

// The end of a list cut short: a secondary button, its words, then a down
// arrow. Activity's loads the next page; a Settings card's shows the rest.

function Label({ children }: { children: ReactNode }) {
  return <>
    {children}
    <ChevronDown size={18} strokeWidth={1.75} aria-hidden className="-mr-0.5" />
  </>;
}

export function ViewMoreLink({ children, ...link }: Omit<ComponentProps<typeof Link>, "className">) {
  return <div className="mt-5">
    <Link className={buttonClass("secondary")} {...link}><Label>{children}</Label></Link>
  </div>;
}

export function ViewMoreButton({ children, ...button }: Omit<ComponentProps<"button">, "className" | "type">) {
  return <div className="mt-5">
    <button type="button" className={buttonClass("secondary")} {...button}><Label>{children}</Label></button>
  </div>;
}
