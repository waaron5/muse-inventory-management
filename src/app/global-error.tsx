"use client";

import { AppearanceScript } from "@/components/appearance";
import { ErrorScreen } from "@/components/error-screen";
import { fontVariables } from "./fonts";
import "./globals.css";

// When the root layout itself fails: it brings its own document, with no shell.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className={`${fontVariables} h-full`}>
      <head>
        <AppearanceScript />
      </head>
      <body className="min-h-full px-4 pt-12 rail:px-6">
        <title>Something went wrong · Muse Inventory</title>
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  );
}
