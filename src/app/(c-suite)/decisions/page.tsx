import Link from "next/link";
import type { Metadata } from "next";
import { Gavel } from "lucide-react";
import { Badge, EmptyState, PageHeader, type Tone } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { requireContext } from "@/server/organizations/service";
import { can } from "@/server/auth/permissions";
import { createDecisionMemoAction, updateDecisionStatusAction } from "@/server/sessions/actions";
import type { Decision } from "@/types/domain";

export const metadata: Metadata = { title: "Decisions" };
const TONE: Record<Decision["status"], Tone> = { PROPOSED: "gold", UNDER_REVIEW: "warn", APPROVED: "ok", REJECTED: "risk", DEFERRED: "neutral" };

export default async function DecisionsPage() {
  const ctx = await requireContext();
  const [decisions, projects] = await Promise.all([db().decisions.list(ctx.organization.id, { orderBy: "created_at", desc: true }), db().projects.list(ctx.organization.id)]);
  const pmap = new Map(projects.map((p) => [p.id, p.name]));
  const canApprove = can(ctx.role, "decisions.approve");
  return (
    <div>
      <PageHeader eyebrow="Organizational Record" title="Decisions" description="Your organization's decision memory: the question, options, recommendation, rationale, risks and confidence — not just conversation history." />
      {decisions.length === 0 ? (
        <EmptyState icon={<Gavel className="size-5" />} title="No decisions recorded yet." body="Decisions are created from C-Level Session syntheses." action={<Link href="/sessions/new" className="text-sm text-gold-300">Convene a session →</Link>} />
      ) : (
        <ul className="space-y-4">
          {decisions.map((d) => (
            <li key={d.id} id={d.id} className="plate p-6 target:shadow-[var(--shadow-gold)]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={TONE[d.status]}>{d.status.replace("_", " ")}</Badge>
                {d.project_id && <Badge>{pmap.get(d.project_id)}</Badge>}
                <span className="ml-auto font-mono text-[10px] text-ivory-faint">CONFIDENCE {Math.round(d.confidence * 100)}% · {formatRelative(d.created_at)}</span>
              </div>
              <h2 className="mt-3 font-heading text-2xl font-semibold">{d.title}</h2>
              <p className="mt-1 text-sm text-ivory-muted">{d.question}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div><p className="font-mono text-[10px] tracking-[0.18em] text-gold-300">RECOMMENDATION</p><p className="mt-1 text-sm">{d.recommendation}</p></div>
                {d.rationale && <div><p className="font-mono text-[10px] tracking-[0.18em] text-gold-300">RATIONALE</p><p className="mt-1 text-sm text-ivory-muted">{d.rationale}</p></div>}
              </div>
              {d.options_json.length > 0 && (
                <div className="mt-4">
                  <p className="font-mono text-[10px] tracking-[0.18em] text-gold-300">OPTIONS</p>
                  <ul className="mt-1.5 space-y-1">
                    {d.options_json.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="w-5 font-mono text-xs text-gold-300">{o.id}</span>
                        <span className={d.chosen_option === o.id || d.recommended_option === o.id ? "text-ivory" : "text-ivory-muted"}>{o.label}</span>
                        {d.chosen_option === o.id ? <Badge tone="ok">Chosen</Badge> : d.recommended_option === o.id && <Badge tone="gold">CEO recommends</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {d.risks_json.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{d.risks_json.map((r, i) => <li key={i}><Badge tone={r.severity === "HIGH" ? "risk" : r.severity === "MEDIUM" ? "warn" : "neutral"}>{r.risk}</Badge></li>)}</ul>}
              {canApprove && d.status !== "APPROVED" && <p className="mt-5 text-[11px] text-ivory-faint">Approving records your choice and saves this decision to C-Level Memory, so the executives remember it in later sessions.</p>}
              {d.status === "APPROVED" && <p className="mt-5 text-[11px] text-ivory-faint">Saved to C-Level Memory.</p>}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-4">
                {canApprove && d.status !== "APPROVED" && (
                  <form action={updateDecisionStatusAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="status" value="APPROVED" />
                    {d.options_json.length > 0 && (
                      <label className="flex items-center gap-2 text-xs text-ivory-muted">
                        Adopt
                        <select name="chosen_option" defaultValue={d.chosen_option ?? d.recommended_option ?? d.options_json[0].id} className="h-8 max-w-[16rem] rounded-full border border-line-strong bg-ink-900 px-3 text-xs text-ivory">
                          {d.options_json.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.label}{d.recommended_option === o.id ? " (CEO recommends)" : ""}</option>)}
                        </select>
                      </label>
                    )}
                    <Button size="sm" variant="gold">{d.options_json.length > 0 ? "Approve with this option" : "Approve"}</Button>
                  </form>
                )}
                {canApprove && d.status !== "APPROVED" && ["DEFERRED", "REJECTED"].map((s) => (
                  <form key={s} action={updateDecisionStatusAction}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="status" value={s} /><Button size="sm" variant="outline">{s.charAt(0) + s.slice(1).toLowerCase()}</Button></form>
                ))}
                <form action={createDecisionMemoAction.bind(null, d.id)}><Button size="sm" variant="ghost">Decision memo</Button></form>
                {d.session_id && <Link href={`/sessions/${d.session_id}`} className="inline-flex h-8 items-center px-3 text-xs text-gold-300">View session →</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
