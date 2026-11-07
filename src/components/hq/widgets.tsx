import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { Badge, SimulatedBadge, type Tone } from "@/components/ui/primitives";
import { cn, formatRelative, truncate } from "@/lib/utils";
import type { AIExecutive, Communication, CSuiteSession, Decision, ProductionJob, Report } from "@/types/domain";

export type ExecMap = Map<string, AIExecutive>;

export function Widget({ title, href, action, children, className }: { title: string; href?: string; action?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("surface flex flex-col p-5", className)} aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="eyebrow">{title}</h2>
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-ivory-muted hover:text-gold-300">
            {action ?? "View all"} <ArrowUpRight className="size-3" />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-ivory-faint">{children}</p>;
}

export function ExecChip({ exec, size = 24 }: { exec?: AIExecutive; size?: number }) {
  if (!exec) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <ExecutiveAvatar src={exec.avatar_url} shortTitle={exec.short_title} accent={exec.accent} size={size} ring={false} />
      <span className="text-xs font-medium" style={{ color: exec.accent }}>{exec.short_title}</span>
    </span>
  );
}

const DECISION_TONE: Record<Decision["status"], Tone> = { PROPOSED: "gold", UNDER_REVIEW: "warn", APPROVED: "ok", REJECTED: "risk", DEFERRED: "neutral" };

export function DecisionCard({ d }: { d: Decision }) {
  return (
    <Link href={`/decisions#${d.id}`} className="block rounded-xl border border-line p-3.5 transition hover:border-line-gold hover:bg-gold-400/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">{d.title}</p>
        <Badge tone={DECISION_TONE[d.status]}>{d.status.replace("_", " ")}</Badge>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-ivory-muted">{d.recommendation}</p>
      <p className="mt-2 font-mono text-[10px] text-ivory-faint">CONFIDENCE {Math.round(d.confidence * 100)}% · {formatRelative(d.created_at)}</p>
    </Link>
  );
}

export function CommunicationPreview({ c, execs }: { c: Communication; execs: ExecMap }) {
  const sender = c.sender_type === "EXECUTIVE" ? execs.get(c.sender_id) : undefined;
  return (
    <Link href={`/comms?thread=${c.thread_id}`} className="flex gap-3 rounded-xl p-2.5 transition hover:bg-white/[0.02]">
      {sender ? <ExecutiveAvatar src={sender.avatar_url} shortTitle={sender.short_title} accent={sender.accent} size={34} ring={false} /> : <span className="grid size-[34px] place-items-center rounded-full bg-ink-800 text-xs">You</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("truncate text-sm", !c.read_at && c.sender_type === "EXECUTIVE" ? "font-semibold text-ivory" : "text-ivory/90")}>{c.subject}</p>
          {c.simulated && <SimulatedBadge />}
        </div>
        <p className="truncate text-xs text-ivory-muted">{truncate(c.body.replace(/[#*_>|-]/g, ""), 110)}</p>
      </div>
      <span className="shrink-0 font-mono text-[10px] text-ivory-faint">{formatRelative(c.created_at)}</span>
    </Link>
  );
}

export function SessionPreview({ s, execs }: { s: CSuiteSession; execs: ExecMap }) {
  return (
    <Link href={`/sessions/${s.id}`} className="block rounded-xl border border-line p-3.5 transition hover:border-line-gold">
      <p className="truncate text-sm font-medium">{s.title}</p>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex -space-x-2">
          {s.participant_executive_ids.slice(0, 7).map((id) => {
            const e = execs.get(id);
            return e ? <ExecutiveAvatar key={id} src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={24} ring={false} className="rounded-full ring-2 ring-ink-900" /> : null;
          })}
        </div>
        <Badge tone={s.status === "RUNNING" ? "gold" : s.status === "FAILED" ? "risk" : "neutral"}>{s.mode.replace(/_/g, " ")}</Badge>
      </div>
    </Link>
  );
}

const JOB_TONE: Partial<Record<ProductionJob["status"], Tone>> = { IN_PROGRESS: "gold", AWAITING_REVIEW: "warn", COMPLETED: "ok", FAILED: "risk", QUEUED: "info" };

export function ProductionJobCard({ j, execs }: { j: ProductionJob; execs: ExecMap }) {
  return (
    <Link href={`/studio/${j.id}`} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-white/[0.02]">
      <ExecChip exec={execs.get(j.lead_executive_id)} size={28} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{j.title}</p>
        <p className="text-xs text-ivory-faint">{j.artifact_type}</p>
      </div>
      <Badge tone={JOB_TONE[j.status] ?? "neutral"}>{j.status.replace(/_/g, " ")}</Badge>
    </Link>
  );
}

export function ReportPreview({ r, execs }: { r: Report; execs: ExecMap }) {
  return (
    <Link href={`/reports/${r.id}`} className="block rounded-xl border border-line p-3.5 transition hover:border-line-gold">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.14em] text-gold-300">{r.report_type.toUpperCase()}</span>
        {r.simulated && <SimulatedBadge />}
      </div>
      <p className="mt-1.5 text-sm font-medium">{r.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-ivory-muted">{r.summary}</p>
      <div className="mt-2.5"><ExecChip exec={execs.get(r.lead_executive_id)} size={20} /></div>
    </Link>
  );
}

export function QuickActionCard({ href, icon: Icon, title, body }: { href: string; icon: LucideIcon; title: string; body: string }) {
  return (
    <Link href={href} className="plate group flex items-start gap-4 p-4 transition hover:-translate-y-0.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line-gold bg-gold-400/[0.06] text-gold-300">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium group-hover:text-gold-200">{title}</span>
        <span className="block text-xs text-ivory-muted">{body}</span>
      </span>
    </Link>
  );
}
