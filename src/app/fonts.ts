import { Hanken_Grotesk, Inter } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["500", "600"],
});

/** The app's two typefaces, as CSS variables on <html>: the root layout and the root error page share them. */
export const fontVariables = `${inter.variable} ${hanken.variable}`;
