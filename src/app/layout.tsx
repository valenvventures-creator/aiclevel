import type { Metadata, Viewport } from "next";
import { Cinzel, IBM_Plex_Mono, Manrope, Playfair_Display, Sora } from "next/font/google";
import "./globals.css";

/*
 * Type system: Sora (headlines) · Manrope (body) · Playfair Display italic
 * (gold accent phrases) · IBM Plex Mono (labels) · Cinzel (the brand
 * wordmark, matching the crest).
 */
const body = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", weight: ["500", "600", "700"], display: "swap" });
const head = Sora({ subsets: ["latin"], variable: "--font-head", weight: ["500", "600", "700"], display: "swap" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", weight: ["400", "500"], style: ["normal", "italic"], display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-code", weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "A.I. C-Suite — Thought Authorities", template: "%s · A.I. C-Suite" },
  description: "Seven C-Suite Executives. One Organization. Shared Intelligence. Your C-Suite, augmented by A.I.",
  applicationName: "A.I. C-Suite",
};

export const viewport: Viewport = { themeColor: "#04060c", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${cinzel.variable} ${head.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-ink-950 text-ivory antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-gold-400 focus:px-3 focus:py-2 focus:text-ink-950">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
