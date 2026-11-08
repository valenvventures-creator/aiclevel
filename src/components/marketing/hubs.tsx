"use client";

import Image from "next/image";
import { CalendarDays, FileText, Landmark, Mail, MessagesSquare, Users, Video } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { cn } from "@/lib/utils";
import { useScrollProgress } from "./motion";
import type { ExecLite } from "./chapters";

/* ------------------------------------------------------------------ */
/* Everything your organization knows → one hub → seven executives     */
/* Vertical: sources at the top zap lightning down into C-Level Memory, */
/* which absorbs it and electrifies each executive below.             */
/* ------------------------------------------------------------------ */

const SOURCES = [
  { icon: Mail, label: "Email" },
  { icon: CalendarDays, label: "Calendar" },
  { icon: Video, label: "Meetings" },
  { icon: FileText, label: "Documents" },
  { icon: Users, label: "CRM" },
  { icon: Landmark, label: "Accounting" },
  { icon: MessagesSquare, label: "Chats" },
];

const W = 1000;
const H = 760;
const HUB = { x: 500, y: 380, r: 84 };
const TOP_Y = 64;
const BOTTOM_Y = 696;
/** One full cycle: sources strike, the memory absorbs, then discharges to the executives. */
const CYCLE = 4.8;

const colX = (i: number, n: number) => (W * (i + 0.5)) / n;

/** Deterministic pseudo-random numbers (identical on server and client). */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 91.17 + salt * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** A jagged lightning path from a to b: midpoints pushed sideways, most in the middle. */
function bolt(ax: number, ay: number, bx: number, by: number, seed: number): string {
  const n = 10;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts = [`M${ax.toFixed(1)} ${ay.toFixed(1)}`];
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const off = (rnd(k, seed) - 0.5) * 2 * 20 * Math.sin(Math.PI * t);
    pts.push(`L${(ax + dx * t + nx * off).toFixed(1)} ${(ay + dy * t + ny * off).toFixed(1)}`);
  }
  pts.push(`L${bx.toFixed(1)} ${by.toFixed(1)}`);
  return pts.join(" ");
}

/** Point on the memory hub's edge facing (x, y). */
function edge(x: number, y: number) {
  const dx = x - HUB.x;
  const dy = y - HUB.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: HUB.x + (dx / d) * HUB.r, y: HUB.y + (dy / d) * HUB.r };
}

function Lightning({ from, to, seed, delay, tone }: { from: { x: number; y: number }; to: { x: number; y: number }; seed: number; delay: number; tone: "in" | "out" }) {
  const paths = [bolt(from.x, from.y, to.x, to.y, seed), bolt(from.x, from.y, to.x, to.y, seed + 37)];
  const color = tone === "in" ? "#dfe6ff" : "#fbf1d0";
  return (
    <g>
      {/* the channel, always faintly visible */}
      <path d={paths[0]} fill="none" stroke={tone === "in" ? "rgba(170,190,255,0.16)" : "rgba(242,207,104,0.16)"} strokeWidth="1" strokeDasharray="2 6" />
      {/* the strike: drawn downwards, crackling between two shapes, then fading */}
      <g className="motion-safe:animate-[zap-flash_var(--cycle)_linear_infinite] opacity-0" style={{ ["--cycle" as string]: `${CYCLE}s`, animationDelay: `${delay}s` }} filter="url(#zap-glow)">
        {paths.map((d, v) => (
          <path
            key={v}
            d={d}
            pathLength={1}
            fill="none"
            stroke={color}
            strokeWidth={v === 0 ? 2.2 : 1.4}
            strokeLinejoin="bevel"
            strokeDasharray="1 1"
            style={{ animation: `zap-draw ${CYCLE}s linear ${delay}s infinite, crackle 0.14s steps(1) ${v * 0.07}s infinite` }}
          />
        ))}
      </g>
    </g>
  );
}

export function SourcesHub({ execs }: { execs: ExecLite[] }) {
  const sources = SOURCES.map((s, i) => ({ ...s, x: colX(i, SOURCES.length) }));
  const people = execs.map((e, i) => ({ ...e, x: colX(i, execs.length) }));
  const dischargeAt = CYCLE * 0.5;
  return (
    <div className="relative mx-auto aspect-[1000/760] w-full max-w-5xl">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id="hubglow"><stop offset="0" stopColor="rgba(239,186,17,0.38)" /><stop offset="1" stopColor="rgba(239,186,17,0)" /></radialGradient>
          <filter id="zap-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={HUB.x} cy={HUB.y} r={HUB.r * 2.2} fill="url(#hubglow)" />
        {/* sources → memory */}
        {sources.map((s, i) => (
          <Lightning key={s.label} from={{ x: s.x, y: TOP_Y + 36 }} to={edge(s.x, TOP_Y)} seed={i + 1} delay={i * 0.11} tone="in" />
        ))}
        {/* memory → executives */}
        {people.map((p, i) => (
          <Lightning key={p.role_code} from={edge(p.x, BOTTOM_Y)} to={{ x: p.x, y: BOTTOM_Y - 34 }} seed={i + 50} delay={dischargeAt + i * 0.1} tone="out" />
        ))}
      </svg>

      {sources.map((s) => (
        <div key={s.label} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5" style={{ left: `${(s.x / W) * 100}%`, top: `${(TOP_Y / H) * 100}%` }}>
          <span className="grid size-8 place-items-center rounded-xl border border-white/10 bg-[rgba(31,38,55,0.7)] text-white/80 shadow-[0_8px_24px_-8px_rgba(0,0,0,.8)] sm:size-11"><s.icon className="size-4 sm:size-5" /></span>
          <span className="hidden whitespace-nowrap text-[11px] text-white/50 sm:inline">{s.label}</span>
        </div>
      ))}

      <div
        className="absolute grid aspect-square w-[17%] min-w-[64px] place-items-center rounded-full border border-line-gold bg-[radial-gradient(circle,#141b2e,#070a14)] motion-safe:animate-[absorb_var(--cycle)_ease-in-out_infinite]"
        style={{ left: `${(HUB.x / W) * 100}%`, top: `${(HUB.y / H) * 100}%`, transform: "translate(-50%, -50%)", boxShadow: "0 0 60px -14px rgba(239,186,17,.45)", ["--cycle" as string]: `${CYCLE}s` }}
      >
        <span aria-hidden className="absolute inset-0 animate-ring rounded-full border border-gold-400/40" />
        <Image src="/brand/crest-256.png" alt="" width={256} height={149} className="w-[70%]" />
      </div>
      {/* label beside the hub, clear of the lightning above and below */}
      <p className="absolute -translate-y-1/2 whitespace-nowrap font-mono text-[9px] tracking-[0.3em] text-gold-300/80 sm:text-[10px]" style={{ left: `${((HUB.x + HUB.r * 1.45) / W) * 100}%`, top: `${(HUB.y / H) * 100}%` }}>C-LEVEL<br />MEMORY</p>

      {people.map((p, i) => (
        <div
          key={p.role_code}
          className="absolute flex flex-col items-center gap-1.5 motion-safe:animate-[jolt_var(--cycle)_ease-out_infinite]"
          style={{ left: `${(p.x / W) * 100}%`, top: `${(BOTTOM_Y / H) * 100}%`, transform: "translate(-50%, -50%)", ["--cycle" as string]: `${CYCLE}s`, animationDelay: `${i * 0.1}s` }}
        >
          <span className="origin-center scale-[0.8] sm:scale-100"><ExecutiveAvatar src={p.avatar_url} shortTitle={p.short_title} accent={p.accent} size={44} ring={false} /></span>
          <span className="hidden whitespace-nowrap font-mono text-[10px] tracking-[0.18em] sm:inline" style={{ color: p.accent }}>{p.short_title}</span>
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
        <p className="eyebrow">C-Level Session</p>
        <h2 className="headline mt-4 text-center text-[clamp(2.4rem,5.4vw,4.4rem)]">Ask once. <span className="accent">Seven perspectives</span></h2>
        <p className="mt-4 text-center text-white/64">
          One question, convened across your C-Level. <b className="text-white">{convened}</b> of {n} convened.
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
