import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/** A person's initials on their saved or automatic colour; no profile photos. */
export function Avatar({ name, small, colour }: { name: string; small?: boolean; colour?: number }) {
  return (
    <span
      aria-hidden
      style={colour === undefined ? undefined : { "--avatar-hue": (colour * 137.507764) % 360 } as CSSProperties}
      className={cn(
        "avatar flex shrink-0 items-center justify-center rounded-full font-medium",
        small ? "size-[30px] text-[12px]" : "size-8 text-[13px]",
      )}
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}
