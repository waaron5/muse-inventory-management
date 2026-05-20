"use client";

import { useState } from "react";

export function DemoBanner() {
  const [isDismissed, setIsDismissed] = useState(false);

  if (process.env.APP_MODE !== "demo") return null;
  if (isDismissed) return null;

  return (
    <div className="demo-banner">
      <span>
        <strong>Demo Mode</strong> — This is a demo with sample data. Data may reset periodically.
      </span>
      <button
        type="button"
        className="demo-banner-close"
        aria-label="Close demo banner"
        onClick={() => setIsDismissed(true)}
      >
        X
      </button>
    </div>
  );
}
