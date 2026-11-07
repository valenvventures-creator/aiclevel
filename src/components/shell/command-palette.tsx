"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Brain, FileText, Mail, MessageSquare, Search, Upload, Users, Workflow, type LucideIcon } from "lucide-react";
import { ALL_NAV } from "./nav-config";
import type { ShellExecutive } from "./app-shell";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  href: string;
  group: string;
}

interface SearchHit {
  type: string;
  id: string;
  title: string;
  snippet: string;
  href: string;
}

export function CommandPalette({ onClose, executives }: { onClose: () => void; executives: ShellExecutive[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const ask = executives.map((e) => ({ id: `ask-${e.slug}`, label: `Ask ${e.short_title}`, hint: e.title, icon: MessageSquare, href: `/executives/${e.slug}?tab=conversation`, group: "Ask an executive" }));
    const actions: Command[] = [
      { id: "message", label: "Message C-Suite", hint: "Executive Comms", icon: Mail, href: "/comms?compose=1", group: "Actions" },
      { id: "session", label: "Start C-Suite Session", hint: "Convene leadership", icon: Users, href: "/sessions/new", group: "Actions" },
      { id: "studio", label: "Open Studio", hint: "Request Finished Work", icon: Workflow, href: "/studio", group: "Actions" },
      { id: "memory", label: "Search Memory", hint: "C-Suite Memory", icon: Brain, href: "/memory", group: "Actions" },
      { id: "upload", label: "Upload File", hint: "Files", icon: Upload, href: "/files?upload=1", group: "Actions" },
      { id: "report", label: "Generate Report", hint: "Reports", icon: FileText, href: "/reports?new=1", group: "Actions" },
    ];
    const nav = ALL_NAV.map((n) => ({ id: `nav-${n.href}`, label: n.label, icon: n.icon, href: n.href, group: "Go to" }));
    return [...actions, ...ask, ...nav];
  }, [executives]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? commands.filter((c) => `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(t)) : commands;
  }, [q, commands]);

  const items: (Command | (SearchHit & { group: string; icon: LucideIcon; label: string }))[] = useMemo(
    () => [...filtered, ...(q.trim().length < 2 ? [] : hits).map((h) => ({ ...h, group: "Organizational intelligence", icon: Search, label: h.title }))],
    [filtered, hits, q],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(t)}`, { signal: ctrl.signal });
        if (res.ok) setHits(((await res.json()) as { results: SearchHit[] }).results);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close command palette" tabIndex={-1} />
      <div className="relative w-full max-w-xl animate-fade-up overflow-hidden rounded-2xl border border-line-strong bg-ink-900 shadow-[0_40px_120px_-20px_rgba(0,0,0,.9)]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-gold-300" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(items.length - 1, i + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter" && items[idx]) go(items[idx].href);
            }}
            placeholder="Type a command or search your organization…"
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-ivory-faint"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={items[idx] ? `cmdk-${idx}` : undefined}
          />
          {loading && <span className="font-mono text-[10px] text-ivory-faint">SEARCHING</span>}
        </div>
        <ul id="cmdk-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-ivory-muted">No matches. Try another phrase.</li>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={`${item.group}-${item.id}`} role="presentation">
                {header && <p className="px-3 pb-1 pt-3 font-mono text-[10px] tracking-[0.2em] text-ivory-faint">{header.toUpperCase()}</p>}
                <button
                  id={`cmdk-${i}`}
                  role="option"
                  aria-selected={i === idx}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => go(item.href)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", i === idx ? "bg-gold-400/[0.08] text-gold-100" : "text-ivory")}
                >
                  <item.icon className="size-4 shrink-0 text-ivory-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    {"snippet" in item ? <span className="block truncate text-xs text-ivory-faint">{item.type} · {item.snippet}</span> : item.hint && <span className="block truncate text-xs text-ivory-faint">{item.hint}</span>}
                  </span>
                  {i === idx && <ArrowRight className="size-3.5 text-gold-300" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 font-mono text-[10px] text-ivory-faint">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
