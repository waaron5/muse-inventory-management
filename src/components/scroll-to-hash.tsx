"use client";

import { useEffect } from "react";

// Someone who already scrolled, tapped or typed stays where they are.
const interactions = ["pointerdown", "keydown", "wheel", "touchmove"];

/**
 * Scrolls to the URL's #section as soon as it appears. Rendered in a page's
 * shell, outside the Suspense its sections stream into, where the browser
 * looked for it too early. Scrolling as the section arrives, before it can
 * be tapped, means nothing moves under someone using it.
 */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const scrolled = () => {
      // React streams a section in hidden, then moves it into place.
      const target = document.getElementById(id);
      if (!target?.getClientRects().length) return false;
      target.scrollIntoView({ block: "start" });
      return true;
    };
    if (scrolled()) return;
    const observer = new MutationObserver(() => { if (scrolled()) stop(); });
    const stop = () => {
      observer.disconnect();
      for (const type of interactions) window.removeEventListener(type, stop, true);
    };
    observer.observe(document.body, { childList: true, subtree: true });
    for (const type of interactions) window.addEventListener(type, stop, true);
    return stop;
  }, []);
  return null;
}
