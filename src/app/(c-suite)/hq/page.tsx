import Link from "next/link";
import type { Metadata } from "next";
import { Brain, Mail, Users, Workflow, ShieldAlert, Gavel } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { CommunicationPreview, DecisionCard, Empty, ProductionJobCard, QuickActionCard, SessionPreview, Widget, ExecChip } from "@/components/hq/widgets";
import { Markdown } from "@/components/ui/markdown";
import { Badge, SimulatedBadge } from "@/components/ui/primitives";
import { greeting, formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { requireContext } from "@/server/organizations/service";
import { canView } from "@/server/memory/retrieval";
import { reviewApprovalAction } from "@/server/approvals/actions";
import { can } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "C-Suite HQ" };

export default async function HQPage() {
  const ctx = await requireContext();
  const orgId = ctx.organization.id;
  const d = db();
  const [execs, decisions, comms, sessions, jobs, reports, memory, approvals] = await Promise.all([
    AIExecutiveRegistry.getAllExecutives(orgId),
    d.decisions.list(orgId, { orderBy: "created_at", desc: true, limit: 20 }),
    d.communications.list(orgId, { orderBy: "created_at", desc: true, limit: 30 }),
    d.sessions.list(orgId, { orderBy: "created_at", desc: true, limit: 4 }),
    d.productionJobs.list(orgId, { orderBy: "created_at", desc: true, limit: 5 }),
    d.reports.list(orgId, { orderBy: "created_at", desc: true, limit: 20 }),
    d.memory.list(orgId, { orderBy: "updated_at", desc: true, limit: 200 }),
    d.approvals.list(orgId, { where: { status: "PENDING" }, orderBy: "created_at", desc: true, limit: 5 }),
  ]);
  const execMap = new Map(execs.map((e) => [e.id, e]));
  const attention = decisions.filter((x) => x.status === "PROPOSED" || x.status === "UNDER_REVIEW").slice(0, 3);
  const inbox = comms.filter((c) => !c.archived && !c.is_draft && c.sender_type === "EXECUTIVE").slice(0, 4);
  const brief = reports.find((r) => r.report_type === "CEO Executive Brief");
  const visibleMemory = memory.filter((m) => canView(m, ctx.role));
  const toConfirm = visibleMemory.filter((m) => m.status === "PROPOSED").slice(0, 3);
  const finance = visibleMemory.filter((m) => m.category === "FINANCE" && m.status !== "ARCHIVED").slice(0, 3);
  const risks = visibleMemory.filter((m) => ["RISKS", "GOVERNANCE", "TECHNOLOGY"].includes(m.category) && m.importance >= 4).slice(0, 3);
  const ceo = execs.find((e) => e.role_code === "CEO");
  const unread = comms.filter((c) => c.sender_type === "EXECUTIVE" && !c.read_at && !c.archived).length;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">C-Suite HQ · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">{greeting(ctx.user.first_name, ctx.user.timezone)}</h1>
          <p className="mt-2 text-sm text-ivory-muted">
            {attention.length + approvals.length > 0 ? (
              <>
                <span className="text-gold-300">{attention.length + approvals.length} items</span> need leadership attention · {unread} unread Executive Comms
              </>
            ) : (
              "Nothing urgent requires leadership attention. Your C-Suite is standing by."
            )}
          </p>
        </div>
        <ul className="flex items-center gap-2" aria-label="C-Suite status">
          {execs.map((e) => (
            <li key={e.id}>
              <Link href={`/executives/${e.slug}`} title={`${e.title} — ${e.status.toLowerCase().replace("_", " ")}`}>
                <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={40} status={e.status} />
              </Link>
            </li>
          ))}
        </ul>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <QuickActionCard href="/sessions/new" icon={Users} title="Convene a C-Suite Session" body="Bring one question to the table." />
        <QuickActionCard href={ceo ? `/executives/${ceo.slug}?tab=conversation` : "/executives"} icon={Brain} title="Ask the CEO" body="Strategic direction, fast." />
        <QuickActionCard href="/comms?compose=1" icon={Mail} title="Message the C-Suite" body="One, several or all seven." />
        <QuickActionCard href="/studio" icon={Workflow} title="Request Finished Work" body="The right executive leads it." />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="plate relative overflow-hidden p-6 lg:col-span-2" aria-label="Daily CEO Brief">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gold-400/10 blur-3xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ExecChip exec={ceo} size={32} />
              <h2 className="font-heading text-2xl font-semibold">Daily CEO Brief</h2>
            </div>
            {brief?.simulated && <SimulatedBadge />}
          </div>
          {brief ? (
            <div className="relative mt-4">
              <Markdown>{brief.content}</Markdown>
              <Link href={`/reports/${brief.id}`} className="mt-3 inline-block text-xs text-gold-300 hover:text-gold-200">Open brief · {formatRelative(brief.created_at)}</Link>
            </div>
          ) : (
            <div className="relative mt-4 text-sm text-ivory-muted">
              <p>No brief yet today. Ask your CEO to prepare one from your C-Suite Memory and recent activity.</p>
              <Link href="/studio?preset=executive_report" className="mt-3 inline-block text-gold-300 hover:text-gold-200">Request today&apos;s brief →</Link>
            </div>
          )}
        </section>

        <Widget title="Decisions requiring attention" href="/decisions">
          <div className="space-y-2.5">
            {attention.length ? attention.map((x) => <DecisionCard key={x.id} d={x} />) : <Empty>No decisions awaiting review.</Empty>}
          </div>
        </Widget>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Widget title="Recent Executive Comms" href="/comms" className="lg:col-span-2">
          <div className="space-y-1">{inbox.length ? inbox.map((c) => <CommunicationPreview key={c.id} c={c} execs={execMap} />) : <Empty>No Executive Comms yet.</Empty>}</div>
        </Widget>
        <Widget title="Awaiting your approval">
          {approvals.length ? (
            <ul className="space-y-2.5">
              {approvals.map((a) => (
                <li key={a.id} className="rounded-xl border border-warn/25 bg-warn/[0.04] p-3.5">
                  <div className="flex items-center gap-2"><ShieldAlert className="size-4 text-warn" aria-hidden /><Badge tone="warn">{a.action_type.replace(/_/g, " ")}</Badge></div>
                  <p className="mt-2 text-sm">{a.summary}</p>
                  <div className="mt-1"><ExecChip exec={execMap.get(a.proposed_by_executive_id)} size={18} /></div>
                  {can(ctx.role, "approvals.review") && (
                    <form action={reviewApprovalAction} className="mt-3 flex gap-2">
                      <input type="hidden" name="id" value={a.id} />
                      <button name="decision" value="APPROVED" className="rounded-full bg-gold-400 px-3 py-1 text-xs font-medium text-ink-950">Approve</button>
                      <button name="decision" value="REJECTED" className="rounded-full border border-line-strong px-3 py-1 text-xs">Reject</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing waiting. Executives propose; you approve.</Empty>
          )}
        </Widget>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Widget title="Financial snapshot" href="/memory?category=FINANCE">
          <ul className="space-y-3">
            {finance.length ? finance.map((m) => (
              <li key={m.id}>
                <p className="text-sm font-medium">{m.title}</p>
                <p className="text-xs text-ivory-muted">{m.content}</p>
              </li>
            )) : <Empty>Add financial facts to C-Suite Memory.</Empty>}
          </ul>
        </Widget>
        <Widget title="Risk & technology alerts" href="/memory">
          <ul className="space-y-3">
            {risks.length ? risks.map((m) => (
              <li key={m.id} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-risk" aria-hidden />
                <div><p className="text-sm font-medium">{m.title}</p><p className="text-xs text-ivory-muted">{m.content}</p></div>
              </li>
            )) : <Empty>No high-importance risks recorded.</Empty>}
          </ul>
        </Widget>
        <Widget title="Active C-Suite Sessions" href="/sessions">
          <div className="space-y-2.5">{sessions.length ? sessions.slice(0, 2).map((s) => <SessionPreview key={s.id} s={s} execs={execMap} />) : <Empty>No C-Suite Sessions yet.</Empty>}</div>
        </Widget>
        <Widget title="Memory needs confirmation" href="/memory?status=PROPOSED">
          <ul className="space-y-3">
            {toConfirm.length ? toConfirm.map((m) => (
              <li key={m.id}>
                <p className="text-sm font-medium">{m.title}</p>
                <p className="line-clamp-2 text-xs text-ivory-muted">{m.content}</p>
              </li>
            )) : <Empty>All memory is verified.</Empty>}
          </ul>
        </Widget>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="C-Suite Studio" href="/studio">
          <div className="space-y-1">{jobs.length ? jobs.map((j) => <ProductionJobCard key={j.id} j={j} execs={execMap} />) : <Empty>No Finished Work yet.</Empty>}</div>
        </Widget>
        <Widget title="Recent decisions" href="/decisions">
          <div className="space-y-2.5">
            {decisions.filter((x) => x.status === "APPROVED").slice(0, 2).map((x) => <DecisionCard key={x.id} d={x} />)}
            {!decisions.some((x) => x.status === "APPROVED") && <Empty><Gavel className="mx-auto mb-2 size-5" />No approved decisions yet.</Empty>}
          </div>
        </Widget>
      </div>
    </div>
  );
}
