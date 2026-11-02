"use client";

import { Pacifico } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const cursive = Pacifico({
  weight: "400",
  subsets: ["latin"],
});

/**
 * "inventory" in script beside the Muse logo, written in left to right on load
 * and again on hover. Reduced motion shows it still.
 */
export function InventoryLogo({ className }: { className?: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const animation = textRef.current?.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }], {
      duration: 1800,
      easing: "ease-in-out",
      fill: "both",
    });

    return () => animation?.cancel();
  }, [replay]);

  // The clip is the span's box, so its tall line and side padding keep the
  // script's swashes inside it; the negative margins give that room back.
  return (
    <span
      ref={textRef}
      aria-hidden
      onMouseEnter={() => setReplay((count) => count + 1)}
      // After className: a text size there would otherwise drop the line height.
      className={cn(cursive.className, className, "inline-block px-[0.15em] leading-[1.7] -mx-[0.15em] -my-[0.35em]")}
    >
      inventory
    </span>
  );
}
