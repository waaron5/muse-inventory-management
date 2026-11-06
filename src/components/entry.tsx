import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { buttonClass } from "./button";

// The parts of sign-in, the first-sign-in name prompt and the Allow screen: a floating card, a heading,
// filled fields whose label sits inside until something's typed, and one
// full-width cyan button with no icon.

export function EntryCard({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col rounded-[24px] bg-entry-card p-6 shadow-entry-card", className)} {...props} />
  );
}

/** The card's heading: the question or ask it puts to the person. */
export function EntryHeading({ className, ...props }: ComponentProps<"h1">) {
  return <h1 className={cn("font-heading text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-balance", className)} {...props} />;
}

/** A filled field; its label reads as the placeholder, then moves up once it's in use. */
export function EntryField({ label, className, ...input }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="relative block">
      <input
        // A blank placeholder, so :placeholder-shown says the field is empty.
        placeholder=" "
        className={cn(
          "peer h-14 w-full rounded-[12px] bg-fill px-4 pt-5 pb-1 text-[16px] font-medium text-ink transition-colors duration-(--motion-hover) hover:bg-hover focus-visible:bg-entry-card focus-visible:outline-2 focus-visible:outline-offset-0",
          className,
        )}
        {...input}
      />
      <span className="pointer-events-none absolute top-4 left-4 origin-left font-heading font-medium text-subtle transition-[translate,scale] duration-(--motion-enter) ease-(--ease-enter) peer-focus:-translate-y-[11px] peer-focus:scale-[0.8] peer-[:not(:placeholder-shown)]:-translate-y-[11px] peer-[:not(:placeholder-shown)]:scale-[0.8] motion-reduce:transition-none">
        {label}
      </span>
    </label>
  );
}

/** The card's one main action: Muse cyan, words only. */
export function EntryButton({ className, ...button }: ComponentProps<"button">) {
  return <button className={buttonClass("main", cn("h-12 w-full rounded-[12px] text-[17px] font-semibold", className))} {...button} />;
}

/** The quiet lines under the button, as text links. */
export function EntryLink({ className, ...button }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn("font-heading text-[14px] font-semibold underline-offset-4 hover:underline disabled:opacity-60", className)}
      {...button}
    />
  );
}
