import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./form";

/** The search box itself: global search's, or a picker's. */
export function SearchInput(input: Omit<ComponentProps<"input">, "type" | "className">) {
  return (
    <div className="relative">
      <Search
        size={18}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
      />
      <input type="search" aria-label="Search" className={cn(fieldClass, "w-full pl-10")} {...input} />
    </div>
  );
}
