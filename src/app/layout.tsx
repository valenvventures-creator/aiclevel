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

const DESCRIPTION = "Seven Executives. One Organization. Shared Intelligence. Your C-Level, augmented by A.I.";

/** Absolute base for link previews (og:image etc.): the configured site address, else the product domain. */
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL && !/localhost|127\.0\.0\.1/.test(process.env.NEXT_PUBLIC_APP_URL) ? process.env.NEXT_PUBLIC_APP_URL : "https://www.aiclevel.io";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "A.I. C-Level", template: "%s · A.I. C-Level" },
  description: DESCRIPTION,
  applicationName: "A.I. C-Level",
  // Link previews (iMessage, Slack, LinkedIn, X…) name the product, not the company.
  // The preview image is src/app/opengraph-image.png (and twitter-image.png).
  openGraph: { type: "website", siteName: "A.I. C-Level", title: "A.I. C-Level", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: "A.I. C-Level", description: DESCRIPTION },
  appleWebApp: { title: "A.I. C-Level" },
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
