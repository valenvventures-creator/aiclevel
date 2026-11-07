import type { Metadata, Viewport } from "next";
import { Cinzel, Inter, Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", weight: ["500", "600", "700"], display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", weight: ["500", "600", "700"], display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], variable: "--font-instrument", weight: "400", style: ["normal", "italic"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb", weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "A.I. C-Suite — Thought Authorities", template: "%s · A.I. C-Suite" },
  description: "Seven C-Suite Executives. One Organization. Shared Intelligence. Your C-Suite, augmented by A.I.",
  applicationName: "A.I. C-Suite",
};

export const viewport: Viewport = { themeColor: "#04060c", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cinzel.variable} ${grotesk.variable} ${instrument.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-ink-950 text-ivory antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-gold-400 focus:px-3 focus:py-2 focus:text-ink-950">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
