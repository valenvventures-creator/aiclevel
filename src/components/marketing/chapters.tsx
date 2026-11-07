"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { cn } from "@/lib/utils";
import { useScrollProgress } from "./motion";

export interface ExecLite { role_code: string; short_title: string; title: string; avatar_url: string; accent: string }

interface Chapter {
  n: number;
  kicker: string;
  chip: string;
  title: ReactNode;
  body: string;
  withLine: ReactNode;
  without: (e: Record<string, ExecLite>) => ReactNode;
  withIt: (e: Record<string, ExecLite>) => ReactNode;
}

/* ------------------------------------------------------------------ */
/* Mock panels                                                          */
/* ------------------------------------------------------------------ */

function Bubble({ who, children, tone = "neutral", time }: { who: string; children: ReactNode; tone?: "neutral" | "you" | "warn"; time?: string }) {
  return (
    <div className={cn("rounded-xl px-3 py-2 text-[12.5px] leading-snug", tone === "you" ? "ml-auto max-w-[80%] bg-white/[0.07]" : tone === "warn" ? "bg-[rgba(255,107,107,0.08)]" : "bg-white/[0.03]")}>
      <p className="mb-0.5 text-[11px] font-semibold text-white/80">
        {who} {time && <span className="font-normal text-white/35">{time}</span>}
      </p>
      <p className="text-white/70">{children}</p>
    </div>
  );
}

function ExecLine({ e, text, highlight }: { e: ExecLite; text: ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("flex gap-2.5 rounded-xl border p-2.5", highlight ? "border-line-gold bg-gold-400/[0.06]" : "border-white/[0.06] bg-white/[0.02]")}>
      <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={26} ring={false} />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold" style={{ color: e.accent }}>{e.title}</p>
        <p className="text-[12.5px] leading-snug text-white/75">{text}</p>
      </div>
    </div>
  );
}

function WindowBar({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
      <p className="text-[12px] font-medium text-white/80">{title}</p>
      {right && <p className="font-mono text-[10px] tracking-[0.12em] text-white/35">{right}</p>}
    </div>
  );
}

const CHAPTERS: Chapter[] = [
  {
    n: 1,
    kicker: "The bottleneck",
    chip: "Monday · 7:02 AM",
    title: <>Every decision runs <span className="accent">through you</span></>,
    body: "Pricing, hiring, contracts, the board deck. Nothing moves until you've thought it through alone.",
    withLine: <><b className="text-white">Your C-Suite weighs in first.</b> Positions, risks and a recommendation are waiting before you decide.</>,
    without: () => (
      <div>
        <WindowBar title="Waiting on you" right="11 OPEN" />
        <div className="space-y-2 p-4">
          {["Should we raise prices for Enterprise?", "Can we afford two hires this quarter?", "Is this partner contract safe to sign?", "What goes in the board update?", "Do we take the Meridian deal?"].map((q, i) => (
            <div key={q} className="flex items-center justify-between rounded-lg bg-[rgba(255,107,107,0.06)] px-3 py-2 text-[12.5px] text-white/75">
              {q}
              <span className="font-mono text-[10px] text-[#ff8a8a]">{i + 2}d waiting</span>
            </div>
          ))}
        </div>
      </div>
    ),
    withIt: (e) => (
      <div>
        <WindowBar title="C-Suite Session · Enterprise pricing" right="CEO SYNTHESIS" />
        <div className="space-y-2 p-4">
          <ExecLine e={e.CFO} text="Annual-only improves year-one cash collection and protects runway." />
          <ExecLine e={e.CCO} text="Default annual; offer quarterly at a premium for procurement-led buyers." />
          <ExecLine e={e.CLO} text="Fine if renewal notices comply. Counsel review recommended." />
          <ExecLine e={e.CEO} highlight text={<><b className="text-white">Recommendation:</b> launch annual-only, revisit after ten deals. Dissent preserved. <span className="text-gold-300">75%</span></>} />
        </div>
      </div>
    ),
  },
  {
    n: 2,
    kicker: "Again",
    chip: "New chat · again",
    title: <>You re-explain your business <span className="accent">to every AI</span></>,
    body: "New chat, same context dump. Every tool starts from zero and none of them remember what you decided.",
    withLine: <><b className="text-white">They already know the business.</b> The Organization Constitution and C-Suite Memory brief every executive.</>,
    without: () => (
      <div>
        <WindowBar title="Generic AI chat" />
        <div className="space-y-2.5 p-4">
          <Bubble who="You" tone="you">OK, context again: we&apos;re a 14-person B2B firm, 58 customers, our runway is about 14 months, our investor is Northwind, we decided annual billing in March…</Bubble>
          <Bubble who="AI">Thanks! To help, could you tell me more about your company, your financials and your goals?</Bubble>
          <p className="text-right font-mono text-[10px] text-[#ff8a8a]">4th time this week</p>
        </div>
      </div>
    ),
    withIt: (e) => (
      <div>
        <WindowBar title={`Executive Office · ${e.CFO.title}`} right="PRIVATE" />
        <div className="space-y-2.5 p-4">
          <Bubble who="You" tone="you">Can we afford two hires this quarter?</Bubble>
          <ExecLine e={e.CFO} text={<>At $68K/mo burn, two hires take runway from 14 to 11 months. Sequence the second after the Northwind extension closes.</>} />
          <div className="flex flex-wrap gap-1.5 pl-9">
            {["Memory · Runway", "Memory · Northwind", "Constitution · 18-mo runway goal"].map((c) => (
              <span key={c} className="rounded-full border border-line-gold/60 px-2 py-0.5 font-mono text-[10px] text-gold-200">{c}</span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    n: 3,
    kicker: "Silos",
    chip: "3 advisors · 3 answers",
    title: <>Your advisors never <span className="accent">talk to each other</span></>,
    body: "Finance says one thing, marketing another, legal hasn't read either. You're the only one connecting the dots.",
    withLine: <><b className="text-white">One thread, the whole C-Suite.</b> Executive Comms puts every perspective in the same conversation.</>,
    without: () => (
      <div className="grid grid-cols-3 gap-2 p-4">
        {[["Accountant", "Cut marketing spend 30%."], ["Agency", "Double paid acquisition now."], ["Lawyer", "Haven't reviewed the deal yet."]].map(([w, t]) => (
          <div key={w} className="rounded-xl border border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.05)] p-3">
            <p className="text-[11px] font-semibold text-white/80">{w}</p>
            <p className="mt-1 text-[12px] text-white/65">{t}</p>
            <p className="mt-3 font-mono text-[9.5px] text-[#ff8a8a]">no shared context</p>
          </div>
        ))}
      </div>
    ),
    withIt: (e) => (
      <div>
        <WindowBar title="Executive Comms · Q3 growth plan" right="CFO · CCO · CLO" />
        <div className="space-y-2 p-4">
          <ExecLine e={e.CCO} text="Paid acquisition is converting at 3.1×; I'd shift budget, not cut it." />
          <ExecLine e={e.CFO} text="Agreed if CAC payback stays under 9 months — I'll watch it weekly." />
          <ExecLine e={e.CLO} text="The Meridian clause restricts other partners. Flagging before we commit." />
        </div>
      </div>
    ),
  },
  {
    n: 4,
    kicker: "Forgotten",
    chip: "Three months later",
    title: <>Decisions disappear into <span className="accent">chat history</span></>,
    body: "Why did we choose that? Who disagreed? What were the risks? Nobody remembers — and it costs you twice.",
    withLine: <><b className="text-white">Every decision becomes a record.</b> Question, options, rationale, risks, confidence and preserved dissent.</>,
    without: () => (
      <div>
        <WindowBar title="#leadership" />
        <div className="space-y-2.5 p-4">
          <Bubble who="Maya" time="Tue 4:12 PM">What did we decide about Enterprise billing in March?</Bubble>
          <Bubble who="Tom" time="Tue 4:31 PM">I think annual? Not sure why though.</Bubble>
          <Bubble who="Maya" tone="warn" time="Tue 4:33 PM">Can&apos;t find it anywhere 😩</Bubble>
        </div>
      </div>
    ),
    withIt: () => (
      <div className="p-4">
        <div className="rounded-xl border border-line-gold/60 bg-gold-400/[0.04] p-4">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-ok/40 px-2 py-0.5 font-mono text-[10px] text-ok">APPROVED</span>
            <span className="font-mono text-[10px] text-white/40">CONFIDENCE 75%</span>
          </div>
          <p className="mt-3 text-[15px] font-semibold text-white">Enterprise billing terms</p>
          <p className="mt-1 text-[12.5px] text-white/70"><b className="text-white/90">Recommendation:</b> annual-only; revisit after ten deals.</p>
          <p className="mt-1 text-[12.5px] text-white/60"><b className="text-white/80">Dissent (CCO):</b> a quarterly premium option would widen the funnel.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Procurement friction · MED", "Renewal compliance · MED"].map((r) => <span key={r} className="rounded-full border border-warn/40 px-2 py-0.5 font-mono text-[10px] text-warn">{r}</span>)}
          </div>
        </div>
      </div>
    ),
  },
  {
    n: 5,
    kicker: "Stalled",
    chip: "Overdue · 3 weeks",
    title: <>The big work <span className="accent">never starts</span></>,
    body: "The investor update, the HR policy, the campaign plan. Important, never urgent, always next week.",
    withLine: <><b className="text-white">Tell your C-Suite what you need.</b> The right executive leads it and delivers versioned Finished Work.</>,
    without: () => (
      <div>
        <WindowBar title="To do" />
        <div className="space-y-2 p-4">
          {[["Investor update", "21 days overdue"], ["Access-review policy", "14 days overdue"], ["Enterprise launch campaign", "not started"], ["Sustainability report", "not started"]].map(([t, s]) => (
            <div key={t} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[12.5px] text-white/75">
              <span className="flex items-center gap-2"><span className="size-3.5 rounded border border-white/25" />{t}</span>
              <span className="font-mono text-[10px] text-[#ff8a8a]">{s}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    withIt: (e) => (
      <div>
        <WindowBar title="C-Suite Studio" right="ROUTED" />
        <div className="space-y-2 p-4">
          {[[e.CFO, "Investor update", "AWAITING REVIEW"], [e.CHRO, "Access-review policy", "FINISHED"], [e.CCO, "Enterprise launch campaign", "IN PROGRESS"], [e.CIO, "Sustainability report", "QUEUED"]].map(([ex, t, s]) => {
            const x = ex as ExecLite;
            return (
              <div key={t as string} className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <ExecutiveAvatar src={x.avatar_url} shortTitle={x.short_title} accent={x.accent} size={22} ring={false} />
                <span className="flex-1 text-[12.5px] text-white/80">{t as string}</span>
                <span className="font-mono text-[10px]" style={{ color: x.accent }}>{s as string}</span>
              </div>
            );
          })}
        </div>
      </div>
    ),
  },
];

/* ------------------------------------------------------------------ */

function ChapterBlock({ c, execs }: { c: Chapter; execs: Record<string, ExecLite> }) {
  const { ref, progress } = useScrollProgress<HTMLElement>();
  const [withIt, setWithIt] = useState(false);
  const lastSide = useRef(false);
  // Flip automatically as the reader passes the midpoint; manual toggles stick until the next crossing.
  useEffect(() => {
    const side = progress > 0.42;
    if (side !== lastSide.current) {
      lastSide.current = side;
      setWithIt(side);
    }
  }, [progress]);

  return (
    <section ref={ref} className="relative py-16 lg:h-[210vh] lg:py-0" aria-labelledby={`ch-${c.n}`}>
      <div className="flex items-center lg:sticky lg:top-0 lg:h-[100svh]">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="flex items-center gap-3 text-sm font-semibold text-white">
              #{c.n} <span className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-white/40">{c.kicker}</span>
            </p>
            <span className="mt-4 inline-block rounded-md bg-[rgba(255,107,107,0.12)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#ff9a9a]">{c.chip}</span>
            <h3 id={`ch-${c.n}`} className="headline mt-4 text-[clamp(2.1rem,4.4vw,3.6rem)]">{c.title}</h3>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/64">{c.body}</p>
            <div className={cn("glass mt-8 max-w-md p-4 transition-all duration-700 ease-[var(--ease-out)]", withIt ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")} aria-hidden={!withIt}>
              <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-gold-300"><span className="size-1.5 rounded-full bg-gold-400" /> WITH YOUR A.I. C-SUITE</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{c.withLine}</p>
            </div>
          </div>

          <div>
            <div role="group" aria-label="Compare" className="mb-3 inline-flex gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
              <button type="button" onClick={() => setWithIt(false)} aria-pressed={!withIt} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-500", !withIt ? "bg-[#ff6b6b] font-medium text-white" : "text-white/45 hover:text-white/80")}>
                <X className="size-3" /> Without a C-Suite
              </button>
              <button type="button" onClick={() => setWithIt(true)} aria-pressed={withIt} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-500", withIt ? "bg-gradient-to-b from-gold-200 to-gold-400 font-medium text-ink-950" : "text-white/45 hover:text-white/80")}>
                <Check className="size-3" /> With your A.I. C-Suite
              </button>
            </div>
            <div className="relative min-h-[430px] overflow-hidden rounded-2xl sm:min-h-[370px] bg-[rgba(12,16,29,0.85)] transition-shadow duration-700 ease-[var(--ease-out)]" style={{ boxShadow: withIt ? "var(--glow-with)" : "var(--glow-without)" }}>
              <div className={cn("absolute inset-0 transition-all duration-700 ease-[var(--ease-out)]", withIt ? "pointer-events-none -translate-y-3 opacity-0 blur-sm" : "opacity-100")} aria-hidden={withIt}>{c.without(execs)}</div>
              <div className={cn("absolute inset-0 transition-all duration-700 ease-[var(--ease-out)]", withIt ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0 blur-sm")} aria-hidden={!withIt}>{c.withIt(execs)}</div>
              <p className="absolute bottom-3 right-4 font-mono text-[9.5px] tracking-[0.2em] text-white/25">ILLUSTRATIVE EXAMPLE</p>
            </div>
          </div>
        </div>
      </div>
      {/* chapter progress tick */}
      <div aria-hidden className="pointer-events-none sticky bottom-0 mx-auto hidden h-px max-w-7xl bg-white/[0.04] lg:block">
        <div className="h-full origin-left bg-gold-400/70" style={{ transform: `scaleX(${progress})` }} />
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
