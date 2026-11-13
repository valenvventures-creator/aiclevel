"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownUp, ContactRound, KanbanSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/crm", label: "Pipeline", icon: KanbanSquare, match: (p: string) => p === "/crm" || p.startsWith("/crm/deals") },
  { href: "/crm/contacts", label: "Contacts", icon: ContactRound, match: (p: string) => p.startsWith("/crm/contacts") },
  { href: "/crm/transfer", label: "Import & Export", icon: ArrowDownUp, match: (p: string) => p.startsWith("/crm/transfer") },
];

/** Section tabs for the CRM. */
export function CrmTabs({ canTransfer }: { canTransfer: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="CRM" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.filter((t) => canTransfer || t.href !== "/crm/transfer").map((t) => {
        const active = t.match(path);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm transition", active ? "text-gold-200" : "text-ivory-muted hover:text-ivory")}>
            <t.icon className="size-4" aria-hidden /> {t.label}
            {active && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-gold-400" />}
          </Link>
        );
      })}
    </nav>
  );
}
