"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Clock, Search } from "lucide-react";

export interface IndexItem { slug: string; title: string; summary: string; minutes: number; who: string; icon: ReactNode; text: string }
export interface IndexGroup { name: string; blurb: string; items: IndexItem[] }

/** Tutorials grouped by category, with a quick filter. */
export function TutorialIndex({ groups }: { groups: IndexGroup[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return groups;
    return groups.map((g) => ({ ...g, items: g.items.filter((i) => words.every((w) => i.text.includes(w))) })).filter((g) => g.items.length);
  }, [groups, q]);
  const count = shown.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-10">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ivory-faint" aria-hidden />
        <label htmlFor="tutorial-search" className="sr-only">Search tutorials</label>
        <input
          id="tutorial-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tutorials, e.g. “vote”, “export PDF”, “invite”"
          className="h-12 w-full rounded-full border border-line-strong bg-ink-900 pl-11 pr-4 text-sm"
        />
        {q && <p role="status" className="mt-2 pl-4 text-xs text-ivory-faint">{count} {count === 1 ? "tutorial" : "tutorials"} found</p>}
      </div>

      {shown.length === 0 && <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-ivory-muted">No tutorial matches “{q}”. Try another word, or browse the topics below.</p>}

      {shown.map((g) => (
        <section key={g.name} aria-labelledby={`cat-${g.name}`}>
          <h2 id={`cat-${g.name}`} className="font-heading text-2xl font-semibold">{g.name}</h2>
          <p className="mb-4 mt-1 text-sm text-ivory-muted">{g.blurb}</p>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {g.items.map((t) => (
              <li key={t.slug}>
                <Link href={`/tutorials/${t.slug}`} className="group flex h-full gap-4 rounded-2xl border border-line p-4 transition hover:border-line-gold hover:bg-gold-400/[0.03]">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line-gold/60 bg-gold-400/[0.06] text-gold-200">{t.icon}</span>
                  <span className="min-w-0">
                    <span className="block font-medium group-hover:text-gold-100">{t.title}</span>
                    <span className="mt-1 block text-sm text-ivory-muted">{t.summary}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.12em] text-ivory-faint">
                      <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden /> {t.minutes} MIN READ</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
