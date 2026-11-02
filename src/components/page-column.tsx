import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const widths = {
  form: "rail:max-w-[560px]",
  detail: "max-w-[760px]",
  compact: "max-w-[480px]",
  print: "rail:max-w-[960px]",
};

/** A bordered, readable column beside the sidebar; the TopRow sits outside. */
export function PageColumn({
  width = "detail",
  className,
  ...props
}: ComponentProps<"div"> & { width?: keyof typeof widths }) {
  return (
    <div
      className={cn(
        "page-column w-full rail:mx-auto rail:rounded-lg rail:border rail:border-line rail:p-8 print:mx-0! print:max-w-none! print:rounded-none! print:border-0! print:p-0!",
        widths[width],
        className,
      )}
      {...props}
    />
  );
}
