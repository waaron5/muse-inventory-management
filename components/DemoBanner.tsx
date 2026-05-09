"use client";

export function DemoBanner() {
  if (process.env.APP_MODE !== "demo") return null;

  return (
    <div className="demo-banner">
      <span>
        <strong>Demo Mode</strong> — This is a demo with sample data. Data may reset periodically.
      </span>
    </div>
  );
}
