import Link from "next/link";
import { FileText, Mail, MessageSquare, Users, Workflow } from "lucide-react";
import { ExecutiveAvatar } from "./executive-avatar";
import type { AIExecutive } from "@/types/domain";

const STATUS_LABEL: Record<AIExecutive["status"], string> = { AVAILABLE: "Available", WORKING: "Working", IN_SESSION: "In session", OFFLINE: "Offline" };

export function ExecutiveCard({ exec, primaryQuestion, activity }: { exec: AIExecutive; primaryQuestion: string; activity?: string }) {
  const actions = [
    { href: `/executives/${exec.slug}?tab=conversation`, label: "Start conversation", icon: MessageSquare },
    { href: `/comms?compose=1&to=${exec.id}`, label: "Send Executive Comms", icon: Mail },
    { href: `/sessions/new?with=${exec.id}`, label: "Invite to C-Suite Session", icon: Users },
    { href: `/studio?lead=${exec.role_code}`, label: "Assign Studio work", icon: Workflow },
    { href: `/executives/${exec.slug}?tab=reports`, label: "Request report", icon: FileText },
  ];
  return (
    <article className="plate group relative flex flex-col overflow-hidden p-6">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full opacity-15 blur-3xl transition-opacity duration-500 group-hover:opacity-35" style={{ background: exec.accent }} />
      <div className="relative flex items-start gap-4">
        <ExecutiveAvatar src={exec.avatar_url} shortTitle={exec.short_title} accent={exec.accent} size={64} status={exec.status} />
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.25em] text-ivory-faint">{String(exec.sort_order).padStart(2, "0")} · {STATUS_LABEL[exec.status].toUpperCase()}</p>
          <h2 className="mt-1 font-heading text-2xl font-semibold leading-tight">
            <Link href={`/executives/${exec.slug}`} className="after:absolute after:inset-0 hover:text-gold-200">{exec.display_name ?? exec.title}</Link>
          </h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em]" style={{ color: exec.accent }}>{exec.functional_mandate}</p>
        </div>
      </div>
      <p className="relative mt-4 font-accent text-lg italic leading-snug text-ivory/85">“{primaryQuestion.replace(/[“”"]/g, "")}”</p>
      {activity && <p className="relative mt-3 text-xs text-ivory-faint">Recent: {activity}</p>}
      <div className="relative z-10 mt-5 flex flex-wrap gap-1.5 border-t border-line pt-4">
        {actions.map((a) => (
          <Link key={a.label} href={a.href} title={a.label} aria-label={`${a.label} — ${exec.title}`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5 text-xs text-ivory-muted transition hover:border-line-gold hover:text-ivory">
            <a.icon className="size-3.5" aria-hidden />
            <span className={a.label === "Start conversation" ? "" : "sr-only sm:not-sr-only"}>{a.label === "Start conversation" ? "Converse" : a.label.split(" ")[0]}</span>
          </Link>
        ))}
      </div>
    </article>
  );
}
