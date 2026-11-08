"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { cn } from "@/lib/utils";
import { useScrollProgress } from "./motion";

export interface ExecLite { role_code: string; short_title: string; title: string; avatar_url: string; accent: string }

/* ------------------------------------------------------------------ */
/* Before / After A.I. C-Suite — each scene is a circle: a centre disc */
/* with satellites on an orbit. Before: scattered, disconnected,       */
/* waiting on you. After: the C-Suite in orbit, wired to one outcome.  */
/* ------------------------------------------------------------------ */

type Satellite =
  | { kind: "note"; title: string; sub?: string }
  | { kind: "exec"; role: string; title: string; sub?: string };

interface Scene {
  center: { eyebrow: string; title: string; sub?: string };
  satellites: Satellite[];
}

interface Chapter {
  n: number;
  kicker: string;
  chip: string;
  title: ReactNode;
  body: string;
  before: Scene;
  after: Scene;
}

const CHAPTERS: Chapter[] = [
  {
    n: 1,
    kicker: "The bottleneck",
    chip: "Monday · 7:02 AM",
    title: <>Every decision runs <span className="accent">through you</span></>,
    body: "Pricing, hiring, contracts, the board deck. Nothing moves until you've thought it through alone.",
    before: {
      center: { eyebrow: "11 open", title: "You", sub: "Every decision waits here" },
      satellites: [
        { kind: "note", title: "Raise Enterprise prices?", sub: "4d waiting" },
        { kind: "note", title: "Two hires this quarter?", sub: "3d waiting" },
        { kind: "note", title: "Partner contract safe?", sub: "6d waiting" },
        { kind: "note", title: "What goes in the board update?", sub: "2d waiting" },
        { kind: "note", title: "Take the Meridian deal?", sub: "5d waiting" },
      ],
    },
    after: {
      center: { eyebrow: "CEO synthesis · 75%", title: "Launch annual-only", sub: "Revisit after ten deals. Dissent preserved." },
      satellites: [
        { kind: "exec", role: "CFO", title: "Protects runway", sub: "Year-one cash up" },
        { kind: "exec", role: "CCO", title: "Annual by default", sub: "Quarterly at a premium" },
        { kind: "exec", role: "CLO", title: "Renewal notices", sub: "Counsel review" },
        { kind: "exec", role: "CHRO", title: "One owner", sub: "Weekly cadence" },
      ],
    },
  },
  {
    n: 2,
    kicker: "Again",
    chip: "New chat · again",
    title: <>You re-explain your business <span className="accent">to every AI</span></>,
    body: "New chat, same context dump. Every tool starts from zero and none of them remember what you decided.",
    before: {
      center: { eyebrow: "4th time this week", title: "You", sub: "Pasting the same context again" },
      satellites: [
        { kind: "note", title: "“Tell me about your company?”", sub: "starts from zero" },
        { kind: "note", title: "Forgot March's billing decision", sub: "no memory" },
        { kind: "note", title: "Doesn't know your runway", sub: "no context" },
        { kind: "note", title: "Another new chat", sub: "context lost" },
      ],
    },
    after: {
      center: { eyebrow: "Already briefed", title: "Hire one now", sub: "Two hires take runway from 14 to 11 months." },
      satellites: [
        { kind: "exec", role: "CFO", title: "Knows your burn", sub: "$68K / month" },
        { kind: "note", title: "Memory · Runway", sub: "verified" },
        { kind: "note", title: "Memory · Northwind", sub: "investor" },
        { kind: "note", title: "Constitution", sub: "18-month runway goal" },
      ],
    },
  },
  {
    n: 3,
    kicker: "Silos",
    chip: "3 advisors · 3 answers",
    title: <>Your advisors never <span className="accent">talk to each other</span></>,
    body: "Finance says one thing, marketing another, legal hasn't read either. You're the only one connecting the dots.",
    before: {
      center: { eyebrow: "No shared context", title: "You", sub: "Connecting the dots alone" },
      satellites: [
        { kind: "note", title: "Accountant", sub: "“Cut marketing 30%”" },
        { kind: "note", title: "Agency", sub: "“Double paid acquisition”" },
        { kind: "note", title: "Lawyer", sub: "“Haven't reviewed it yet”" },
      ],
    },
    after: {
      center: { eyebrow: "Executive Comms", title: "One thread", sub: "Q3 growth plan, whole C-Suite" },
      satellites: [
        { kind: "exec", role: "CCO", title: "Shift budget", sub: "Converting at 3.1×" },
        { kind: "exec", role: "CFO", title: "CAC payback < 9 mo", sub: "Watched weekly" },
        { kind: "exec", role: "CLO", title: "Clause flagged", sub: "Before we commit" },
      ],
    },
  },
  {
    n: 4,
    kicker: "Forgotten",
    chip: "Three months later",
    title: <>Decisions disappear into <span className="accent">chat history</span></>,
    body: "Why did we choose that? Who disagreed? What were the risks? Nobody remembers — and it costs you twice.",
    before: {
      center: { eyebrow: "#leadership", title: "Why?", sub: "“Can't find it anywhere”" },
      satellites: [
        { kind: "note", title: "What did we decide?", sub: "Tue 4:12 PM" },
        { kind: "note", title: "Who disagreed?", sub: "unknown" },
        { kind: "note", title: "What were the risks?", sub: "lost" },
        { kind: "note", title: "“Annual? Not sure why”", sub: "Tue 4:31 PM" },
      ],
    },
    after: {
      center: { eyebrow: "Approved · 75%", title: "Enterprise billing", sub: "Annual-only; revisit after ten deals." },
      satellites: [
        { kind: "note", title: "Rationale", sub: "recorded" },
        { kind: "exec", role: "CCO", title: "Dissent kept", sub: "Quarterly premium" },
        { kind: "note", title: "Risk", sub: "Procurement · MED" },
        { kind: "note", title: "Risk", sub: "Renewal compliance · MED" },
      ],
    },
  },
  {
    n: 5,
    kicker: "Stalled",
    chip: "Overdue · 3 weeks",
    title: <>The big work <span className="accent">never starts</span></>,
    body: "The investor update, the HR policy, the campaign plan. Important, never urgent, always next week.",
    before: {
      center: { eyebrow: "To do", title: "Next week", sub: "Important, never urgent" },
      satellites: [
        { kind: "note", title: "Investor update", sub: "21d overdue" },
        { kind: "note", title: "Access-review policy", sub: "14d overdue" },
        { kind: "note", title: "Launch campaign", sub: "not started" },
        { kind: "note", title: "Sustainability report", sub: "not started" },
      ],
    },
    after: {
      center: { eyebrow: "C-Suite Studio", title: "Routed", sub: "The right executive leads each piece" },
      satellites: [
        { kind: "exec", role: "CFO", title: "Investor update", sub: "Awaiting review" },
        { kind: "exec", role: "CHRO", title: "Access policy", sub: "Finished" },
        { kind: "exec", role: "CCO", title: "Launch campaign", sub: "In progress" },
        { kind: "exec", role: "CIO", title: "Sustainability", sub: "Queued" },
      ],
    },
  },
];

/* ------------------------------------------------------------------ */
/* The circular scene                                                  */
/* ------------------------------------------------------------------ */

const ORBIT = 37; // % of the circle, centre to satellite
const pos = (i: number, n: number, offset = 0) => {
  const a = ((-90 + offset + (i * 360) / n) * Math.PI) / 180;
  return { left: `${50 + ORBIT * Math.cos(a)}%`, top: `${50 + ORBIT * Math.sin(a)}%` };
};

/** Font size that scales with the circle (container query units), clamped. */
const fs = (min: number, cq: number, max: number): CSSProperties => ({ fontSize: `clamp(${min}px, ${cq}cqw, ${max}px)` });

function SceneCircle({ scene, after, execs, shown }: { scene: Scene; after: boolean; execs: Record<string, ExecLite>; shown: boolean }) {
  const n = scene.satellites.length;
  const offset = n === 3 ? 0 : n === 4 ? 45 : 0;
  return (
    <div
      className={cn("absolute inset-0 transition-all duration-[900ms] ease-[var(--ease-out)]", shown ? "rotate-0 scale-100 opacity-100" : after ? "pointer-events-none -rotate-12 scale-90 opacity-0" : "pointer-events-none rotate-12 scale-90 opacity-0")}
      aria-hidden={!shown}
    >
      {/* rings and connections */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id={`face-${after ? "a" : "b"}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.55" stopColor={after ? "rgba(239,186,17,0.10)" : "rgba(255,107,107,0.06)"} />
            <stop offset="1" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="49" fill={`url(#face-${after ? "a" : "b"})`} />
        <g className="motion-safe:animate-[orbit_80s_linear_infinite]" style={{ transformBox: "view-box", transformOrigin: "50px 50px", animationDirection: after ? "normal" : "reverse" }}>
          <circle cx="50" cy="50" r="49" fill="none" stroke={after ? "rgba(242,207,104,0.55)" : "rgba(255,107,107,0.35)"} strokeWidth="0.35" strokeDasharray={after ? "0" : "6 4 1.5 4"} />
          <circle cx="50" cy="50" r="45.5" fill="none" stroke={after ? "rgba(242,207,104,0.2)" : "rgba(255,107,107,0.12)"} strokeWidth="0.25" strokeDasharray="0.6 2.2" />
        </g>
        <circle cx="50" cy="50" r={ORBIT} fill="none" stroke={after ? "rgba(242,207,104,0.28)" : "rgba(255,107,107,0.18)"} strokeWidth="0.3" strokeDasharray={after ? "1.2 1.6" : "3 5"} />
        {after &&
          scene.satellites.map((_, i) => {
            const a = ((-90 + offset + (i * 360) / n) * Math.PI) / 180;
            return (
              <line key={i} x1={50 + 19 * Math.cos(a)} y1={50 + 19 * Math.sin(a)} x2={50 + (ORBIT - 12) * Math.cos(a)} y2={50 + (ORBIT - 12) * Math.sin(a)} stroke="rgba(242,207,104,0.75)" strokeWidth="0.45" strokeDasharray="1.4 1.4" className="animate-flow" style={{ animationDelay: `${i * 0.2}s` }} />
            );
          })}
        {/* After: the executives also talk to each other — an arc joins neighbours */}
        {after && n > 1 && <circle cx="50" cy="50" r={ORBIT} fill="none" stroke="rgba(242,207,104,0.5)" strokeWidth="0.5" strokeDasharray="2 4" className="animate-flow" />}
      </svg>

      {/* centre disc */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 flex aspect-square w-[38%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full p-[4%] text-center",
          after ? "border border-line-gold bg-[radial-gradient(circle_at_40%_30%,#1d2540,#070a14)] shadow-[0_0_80px_-10px_rgba(239,186,17,.7)]" : "border border-[rgba(255,107,107,0.35)] bg-[radial-gradient(circle_at_40%_30%,#2a1418,#0b0709)] shadow-[0_0_70px_-12px_rgba(255,107,107,.55)] motion-safe:animate-[pulse-soft_2.4s_ease-in-out_infinite]",
        )}
      >
        {after && <Image src="/brand/crest-256.png" alt="" width={256} height={149} className="mb-[3%] w-[34%]" />}
        <p className={cn("font-mono uppercase tracking-[0.18em]", after ? "text-gold-300" : "text-[#ff9a9a]")} style={fs(8, 1.7, 11)}>{scene.center.eyebrow}</p>
        <p className={cn("mt-[2%] font-heading font-semibold leading-tight", after ? "text-white" : "text-white/90")} style={fs(13, 4.2, 26)}>{scene.center.title}</p>
        {scene.center.sub && <p className="mt-[2%] leading-snug text-white/60" style={fs(9, 1.9, 13)}>{scene.center.sub}</p>}
      </div>

      {/* satellites */}
      {scene.satellites.map((s, i) => {
        const e = s.kind === "exec" ? execs[s.role] : null;
        return (
          <div
            key={i}
            className={cn(
              "absolute flex aspect-square w-[26%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full p-[3%] text-center transition-all duration-700",
              after ? "border border-line-gold/70 bg-[rgba(14,19,34,0.92)] shadow-[0_0_34px_-10px_rgba(239,186,17,.6)]" : "border border-[rgba(255,107,107,0.28)] bg-[rgba(26,12,15,0.85)]",
            )}
            style={{ ...pos(i, n, offset), transitionDelay: shown ? `${150 + i * 90}ms` : "0ms" }}
          >
            {e && (
              <span className="mb-[5%]"><ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={32} ring={false} /></span>
            )}
            <p className={cn("font-medium leading-tight", after ? "text-white/90" : "text-white/80")} style={fs(9, 1.9, 13)}>{s.title}</p>
            {s.sub && <p className={cn("mt-[3%] font-mono leading-tight", after ? "text-gold-200/80" : "text-[#ff8a8a]")} style={fs(7, 1.45, 10)}>{s.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** A round dial that switches between Before and After. */
function Dial({ after, onChange }: { after: boolean; onChange: (v: boolean) => void }) {
  return (
    <div role="group" aria-label="Compare before and after the A.I. C-Suite" className="flex items-center justify-center gap-3 sm:gap-4">
      <button type="button" onClick={() => onChange(false)} aria-pressed={!after} className={cn("flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-xs transition-colors duration-500 sm:text-sm", !after ? "text-white" : "text-white/40 hover:text-white/75")}>
        <span className={cn("size-3 rounded-full border transition-all duration-500", !after ? "border-[#ff6b6b] bg-[#ff6b6b] shadow-[0_0_12px_rgba(255,107,107,.8)]" : "border-white/30")} />
        Before A.I. C-Suite
      </button>
      <button
        type="button"
        onClick={() => onChange(!after)}
        aria-label={after ? "Show before the A.I. C-Suite" : "Show after the A.I. C-Suite"}
        className={cn("relative grid size-14 shrink-0 place-items-center rounded-full border transition-all duration-700", after ? "border-line-gold bg-[radial-gradient(circle,#1d2540,#070a14)] shadow-[0_0_30px_-4px_rgba(239,186,17,.7)]" : "border-[rgba(255,107,107,0.45)] bg-[radial-gradient(circle,#2a1418,#0b0709)] shadow-[0_0_26px_-6px_rgba(255,107,107,.6)]")}
      >
        <span className={cn("absolute h-[2px] w-[42%] origin-left rounded-full transition-transform duration-700 ease-[var(--ease-out)]", after ? "bg-gold-300" : "bg-[#ff8a8a]")} style={{ left: "50%", top: "calc(50% - 1px)", transform: after ? "rotate(0deg)" : "rotate(180deg)" }} />
        <span className={cn("size-2.5 rounded-full", after ? "bg-gold-200" : "bg-[#ffb3b3]")} />
      </button>
      <button type="button" onClick={() => onChange(true)} aria-pressed={after} className={cn("flex items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 text-xs transition-colors duration-500 sm:text-sm", after ? "text-gold-100" : "text-white/40 hover:text-white/75")}>
        After A.I. C-Suite
        <span className={cn("size-3 rounded-full border transition-all duration-500", after ? "border-gold-300 bg-gold-300 shadow-[0_0_12px_rgba(239,186,17,.9)]" : "border-white/30")} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ChapterBlock({ c, execs }: { c: Chapter; execs: Record<string, ExecLite> }) {
  const { ref, progress } = useScrollProgress<HTMLElement>();
  const [after, setAfter] = useState(false);
  const lastSide = useRef(false);
  // Flip automatically as the reader passes the midpoint; manual toggles stick until the next crossing.
  useEffect(() => {
    const side = progress > 0.42;
    if (side !== lastSide.current) {
      lastSide.current = side;
      setAfter(side);
    }
  }, [progress]);

  return (
    <section ref={ref} className="relative py-16 lg:h-[210vh] lg:py-0" aria-labelledby={`ch-${c.n}`}>
      <div className="flex items-center lg:sticky lg:top-0 lg:h-[100svh]">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <div>
            <div className="flex items-center gap-4">
              {/* number badge with a circular progress ring for this chapter */}
              <span className={cn("relative grid size-14 place-items-center rounded-full font-heading text-lg transition-colors duration-700", after ? "text-gold-200 shadow-[0_0_24px_-6px_rgba(239,186,17,.6)]" : "text-[#ffb3b3]")}>
                <svg viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90" aria-hidden>
                  <circle cx="28" cy="28" r="26.5" fill="none" stroke={after ? "rgba(242,207,104,0.25)" : "rgba(255,107,107,0.3)"} strokeWidth="1.5" />
                  <circle cx="28" cy="28" r="26.5" fill="none" stroke={after ? "#f2cf68" : "#ff8a8a"} strokeWidth="1.5" strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.min(1, Math.max(0, progress))} 1`} />
                </svg>
                {String(c.n).padStart(2, "0")}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">{c.kicker}</span>
            </div>
            <span className="mt-5 inline-block rounded-full bg-[rgba(255,107,107,0.12)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#ff9a9a]">{c.chip}</span>
            <h3 id={`ch-${c.n}`} className="headline mt-4 text-[clamp(2rem,4.2vw,3.4rem)]">{c.title}</h3>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/64">{c.body}</p>
          </div>

          <div className="flex flex-col items-center">
            <Dial after={after} onChange={setAfter} />
            <div className="relative mt-6 aspect-square w-[min(560px,90vw)] [container-type:inline-size]">
              <SceneCircle scene={c.before} after={false} execs={execs} shown={!after} />
              <SceneCircle scene={c.after} after execs={execs} shown={after} />
            </div>
            <p className="mt-3 font-mono text-[9.5px] tracking-[0.2em] text-white/25">ILLUSTRATIVE EXAMPLE</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Chapters({ execs }: { execs: ExecLite[] }) {
  const byRole = Object.fromEntries(execs.map((e) => [e.role_code, e]));
  return (
    <div>
      {CHAPTERS.map((c) => <ChapterBlock key={c.n} c={c} execs={byRole} />)}
    </div>
  );
}
