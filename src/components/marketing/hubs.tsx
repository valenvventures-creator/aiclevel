"use client";

import Image from "next/image";
import { CalendarDays, FileText, Landmark, Mail, MessagesSquare, Users, Video } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { cn } from "@/lib/utils";
import { useScrollProgress } from "./motion";
import type { ExecLite } from "./chapters";

/* ------------------------------------------------------------------ */
/* Everything your organization knows → one hub → seven executives     */
/* ------------------------------------------------------------------ */

const SOURCES = [
  { icon: Mail, label: "Email" },
  { icon: CalendarDays, label: "Calendar" },
  { icon: Video, label: "Meetings" },
  { icon: FileText, label: "Documents" },
  { icon: Users, label: "CRM" },
  { icon: Landmark, label: "Accounting" },
  { icon: MessagesSquare, label: "Team chat" },
];

export function SourcesHub({ execs }: { execs: ExecLite[] }) {
  const rows = 7;
  const yOf = (i: number) => 60 + i * (480 / (rows - 1));
  return (
    <div className="relative mx-auto aspect-[1000/600] w-full max-w-6xl">
      <svg viewBox="0 0 1000 600" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id="in" x1="0" x2="1"><stop offset="0" stopColor="rgba(170,190,255,0.05)" /><stop offset="1" stopColor="rgba(242,207,104,0.7)" /></linearGradient>
          <linearGradient id="out" x1="0" x2="1"><stop offset="0" stopColor="rgba(242,207,104,0.7)" /><stop offset="1" stopColor="rgba(242,207,104,0.08)" /></linearGradient>
          <radialGradient id="hubglow"><stop offset="0" stopColor="rgba(239,186,17,0.35)" /><stop offset="1" stopColor="rgba(239,186,17,0)" /></radialGradient>
        </defs>
        <circle cx="500" cy="300" r="170" fill="url(#hubglow)" />
        {Array.from({ length: rows }, (_, i) => (
          <g key={i}>
            <path d={`M 90 ${yOf(i)} C 300 ${yOf(i)}, 330 300, 455 300`} fill="none" stroke="url(#in)" strokeWidth="1.2" strokeDasharray="3 7" className="animate-flow" style={{ animationDelay: `${i * 0.15}s` }} />
            <path d={`M 545 300 C 670 300, 700 ${yOf(i)}, 910 ${yOf(i)}`} fill="none" stroke="url(#out)" strokeWidth="1.2" strokeDasharray="3 7" className="animate-flow" style={{ animationDelay: `${i * 0.15 + 0.4}s` }} />
          </g>
        ))}
      </svg>

      {SOURCES.map((s, i) => (
        <div key={s.label} className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2" style={{ left: "6%", top: `${(yOf(i) / 600) * 100}%` }}>
          <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-[rgba(31,38,55,0.7)] text-white/80 shadow-[0_8px_24px_-8px_rgba(0,0,0,.8)] sm:size-11"><s.icon className="size-4 sm:size-5" /></span>
          <span className="hidden whitespace-nowrap text-[11px] text-white/45 lg:inline">{s.label}</span>
        </div>
      ))}

      <div className="absolute left-1/2 top-1/2 grid aspect-square w-[17%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line-gold bg-[radial-gradient(circle,#141b2e,#070a14)] shadow-[0_0_80px_-10px_rgba(239,186,17,.6)]">
        <span aria-hidden className="absolute inset-0 animate-ring rounded-full border border-gold-400/40" />
        <Image src="/brand/crest-256.png" alt="" width={256} height={149} className="w-[70%]" />
      </div>
      <p className="absolute left-1/2 top-[66%] -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tracking-[0.3em] text-gold-300/80">C-SUITE MEMORY</p>

      {execs.map((e, i) => (
        <div key={e.role_code} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-row-reverse items-center gap-2" style={{ left: "94%", top: `${(yOf(i) / 600) * 100}%` }}>
          <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={40} ring={false} />
          <span className="hidden whitespace-nowrap font-mono text-[10px] tracking-[0.18em] lg:inline" style={{ color: e.accent }}>{e.short_title}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ask once. Seven perspectives. (scroll-driven convening)             */
/* ------------------------------------------------------------------ */

const ANSWERS: Record<string, string> = {
  CEO: "Proceed in stages; it compounds our advantage.",
  CFO: "Affordable if payback stays under 9 months.",
  CCO: "Strong story — lead with Enterprise proof.",
  CHRO: "Needs one owner and a weekly cadence.",
  CTO: "Feasible on current stack in 6 weeks.",
  CLO: "Review the partner clause before signing.",
  CIO: "Measure community benefit from day one.",
};

export function ConveneHub({ execs }: { execs: ExecLite[] }) {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();
  const convened = Math.min(execs.length, Math.floor(progress * (execs.length + 1.5)));
  const n = execs.length;
  const xOf = (i: number) => 1000 * ((i + 0.5) / n);
  return (
    <div ref={ref} className="relative py-24 md:h-[200vh] md:py-0">
      <div className="flex flex-col items-center justify-center px-4 sm:px-6 md:sticky md:top-0 md:h-[100svh]">
        <p className="eyebrow">C-Suite Session</p>
        <h2 className="headline mt-4 text-center text-[clamp(2.4rem,5.4vw,4.4rem)]">Ask once. <span className="accent">Seven perspectives</span></h2>
        <p className="mt-4 text-center text-white/64">
          One question, convened across your C-Suite. <b className="text-white">{convened}</b> of {n} convened.
        </p>

        <div className="relative mt-10 w-full max-w-7xl">
          <svg viewBox="0 0 1000 220" className="hidden h-[150px] w-full md:block" preserveAspectRatio="none" aria-hidden>
            {execs.map((e, i) => {
              const on = i < convened;
              return (
                <path key={e.role_code} d={`M 500 0 C 500 120, ${xOf(i)} 90, ${xOf(i)} 220`} fill="none" stroke={on ? "rgba(242,207,104,0.85)" : "rgba(255,255,255,0.08)"} strokeWidth={on ? 1.6 : 1} style={{ transition: "stroke .8s var(--ease-out)", filter: on ? "drop-shadow(0 0 6px rgba(239,186,17,.8))" : "none" }} />
              );
            })}
          </svg>
          <div className="absolute left-1/2 top-0 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <div className="grid size-16 place-items-center rounded-full border border-line-gold bg-ink-900 shadow-[0_0_50px_-6px_rgba(239,186,17,.7)]">
              <Image src="/brand/crest-256.png" alt="" width={256} height={149} className="w-11" />
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {execs.map((e, i) => {
              const on = i < convened;
              return (
                <li key={e.role_code} style={{ transitionDelay: on ? `${(i % 4) * 90}ms` : "0ms" }} className={cn("rounded-2xl border p-3 transition-all duration-700 ease-[var(--ease-out)]", on ? "border-line-gold bg-[rgba(31,38,55,0.7)] shadow-[0_0_40px_-12px_rgba(239,186,17,.6)]" : "border-white/[0.06] bg-white/[0.02] opacity-60")}>
                  <div className="flex items-center gap-2">
                    <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={26} ring={false} />
                    <span className="font-mono text-[10px] tracking-[0.16em]" style={{ color: e.accent }}>{e.short_title}</span>
                  </div>
                  <p className={cn("mt-2 flex items-center gap-1 text-[10px]", on ? "text-ok" : "text-white/35")}>
                    <span className={cn("size-1.5 rounded-full", on ? "bg-ok" : "bg-white/25")} /> {on ? "Position ready" : "Standing by"}
                  </p>
                  <p className={cn("mt-2 min-h-[3.2em] text-[11.5px] leading-snug transition-opacity duration-700", on ? "text-white/80 opacity-100" : "opacity-0")}>{ANSWERS[e.role_code]}</p>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-center font-mono text-[10px] tracking-[0.2em] text-white/30">ILLUSTRATIVE EXAMPLE</p>
        </div>
      </div>
    </div>
  );
}
