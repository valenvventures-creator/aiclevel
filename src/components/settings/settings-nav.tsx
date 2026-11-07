"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SETTINGS_SECTIONS } from "./nav";

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="scrollbar-thin -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
      {SETTINGS_SECTIONS.map(([k, label]) => {
        const href = `/settings/${k}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={k} href={href} aria-current={active ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-sm transition", active ? "bg-gold-400/[0.08] text-gold-200" : "text-ivory-muted hover:bg-white/[0.03] hover:text-ivory")}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
