import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Muse Event Management",
  description: "Internal inventory and event management for Muse",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
