"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { cn } from "@/lib/utils";
import { useTypewriter } from "./motion";
import type { ExecLite } from "./chapters";

const SCRIPTS: Record<string, { q: string; a: string; sources: string[] }> = {
  CEO: { q: "What should we focus on this quarter?", a: "Three things, in this order: close the seed extension, launch Enterprise, and finish SOC 2 readiness. Each unlocks the next. Keep the giving initiative on hold until runway clears 18 months.", sources: ["Constitution · priorities", "Decision · Enterprise billing", "Memory · Runway"] },
  CFO: { q: "Can we afford two hires right now?", a: "Not both. At $68K monthly burn, two hires take runway from 14 to 11 months. Hire the Customer Success lead now and sequence the second Account Executive after the Northwind extension closes.", sources: ["Memory · Runway", "Memory · Northwind", "File · FY Operating Plan"] },
  CLO: { q: "Is the Meridian partner deal safe to sign?", a: "Not as drafted. The exclusivity clause would restrict future channel partners and the termination terms favour Meridian. Negotiate those two points first. Counsel review recommended: yes.", sources: ["File · Meridian terms", "Memory · Channel strategy"] },
};

export function LiveDemo({ execs }: { execs: ExecLite[] }) {
  const byRole = Object.fromEntries(execs.map((e) => [e.role_code, e]));
  const [role, setRole] = useState<keyof typeof SCRIPTS>("CFO");
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setActive(true), { threshold: 0.4 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  const e = byRole[role];
  const pick = (r: keyof typeof SCRIPTS) => setRole(r);

  return (
    <div ref={ref}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1.5" role="tablist" aria-label="Choose an executive">
          {(Object.keys(SCRIPTS) as (keyof typeof SCRIPTS)[]).map((r) => (
            <button key={r} role="tab" aria-selected={role === r} onClick={() => pick(r)} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition", role === r ? "border-line-gold bg-gold-400/10 text-white" : "border-white/[0.08] text-white/50 hover:text-white")}>
              <span className="size-1.5 rounded-full" style={{ background: byRole[r]?.accent }} /> {r}
            </button>
          ))}
        </div>
        <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.16em] text-white/40">EXAMPLE DATA</span>
      </div>
      <div className="flex min-h-[380px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(12,16,29,0.9)] shadow-[0_40px_120px_-40px_rgba(239,186,17,.35)]">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 text-[12px] text-white/70">
          {e && <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={20} ring={false} />} Executive Office · {e?.title}
        </div>
        <Conversation key={role} script={SCRIPTS[role]} exec={e} active={active} />
        <div className="m-3 flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-[13px] text-white/35">
          Ask the {e?.title}…
          <span className="grid size-7 place-items-center rounded-full bg-gold-400 text-ink-950"><ArrowUp className="size-3.5" /></span>
        </div>
      </div>
    </div>
  );
}

function Conversation({ script: s, exec: e, active }: { script: (typeof SCRIPTS)[string]; exec: ExecLite | undefined; active: boolean }) {
  const [phase, setPhase] = useState<"q" | "a">("q");
  const q = useTypewriter(s.q, active, 32);
  const qDone = active && q.length === s.q.length;
  useEffect(() => {
    if (!qDone) return;
    const t = setTimeout(() => setPhase("a"), 500);
    return () => clearTimeout(t);
  }, [qDone]);
  const a = useTypewriter(s.a, phase === "a", 14);
  return (
        <div className="flex-1 space-y-4 p-5" aria-live="polite">
          {q && <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.07] px-4 py-2.5 text-[13.5px]">{q}</div>}
          {phase === "a" && e && (
            <div className="flex gap-3">
              <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={30} ring={false} />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold" style={{ color: e.accent }}>{e.title}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-white/85">{a}<span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-blink bg-gold-300" /></p>
                {a.length === s.a.length && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.sources.map((src) => <span key={src} className="animate-fade-up rounded-full border border-line-gold/60 px-2 py-0.5 font-mono text-[10px] text-gold-200">{src}</span>)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
  );
}
