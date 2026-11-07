"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/brand";
import { cn } from "@/lib/utils";

const LINKS = [
  ["How it works", "#how"],
  ["Executives", "#executives"],
  ["Sessions", "#sessions"],
  ["Security", "#security"],
  ["FAQ", "#faq"],
] as const;

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-[var(--ease-out)]", scrolled || open ? "border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {LINKS.map(([l, h]) => (
            <a key={h} href={h} className="text-[13.5px] text-white/60 transition-colors duration-200 hover:text-white">{l}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden h-10 items-center rounded-full bg-white/[0.04] px-[18px] text-sm text-white/90 transition hover:bg-white/[0.08] sm:inline-flex">Sign in</Link>
          <Link href="/signup" className="group hidden h-10 items-center gap-1.5 rounded-full bg-gradient-to-b from-gold-200 to-gold-400 px-[18px] text-sm font-medium text-ink-950 shadow-[0_0_30px_-6px_rgba(239,186,17,.7)] transition-all duration-500 ease-[var(--ease-out)] hover:shadow-[0_0_44px_-4px_rgba(239,186,17,.9)] sm:inline-flex">
            Convene your C-Suite <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
          <button className="grid size-10 place-items-center rounded-full text-white/80 lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Mobile" className="animate-fade-up border-t border-white/[0.06] px-4 pb-6 pt-2 lg:hidden">
          {LINKS.map(([l, h]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="block py-3 text-lg text-white/80">{l}</a>
          ))}
          <div className="mt-4 grid gap-2">
            <Link href="/signup" className="flex h-12 items-center justify-center rounded-full bg-gradient-to-b from-gold-200 to-gold-400 font-medium text-ink-950">Convene your C-Suite</Link>
            <Link href="/login" className="flex h-12 items-center justify-center rounded-full bg-white/[0.05]">Sign in</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
