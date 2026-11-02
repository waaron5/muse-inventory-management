import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { AppearanceScript } from "@/components/appearance";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Muse Inventory", template: "%s · Muse Inventory" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  // --bg in each theme. The bars follow the system: a saved Appearance can't reach them before paint.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161618" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The Appearance script sets data-theme on <html> before React hydrates it.
    <html lang="en" className={`${fontVariables} h-full`} suppressHydrationWarning>
      <head>
        <AppearanceScript />
      </head>
      <body className="min-h-full">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
