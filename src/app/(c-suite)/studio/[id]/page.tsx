import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { ExecChip } from "@/components/hq/widgets";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { Markdown } from "@/components/ui/markdown";
import { Alert, Badge, Card, SectionTitle, SimulatedBadge, Textarea } from "@/components/ui/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { requireContext } from "@/server/organizations/service";
import { approveJobAction, requestRevisionAction, retryJobAction, saveAsReportAction } from "@/server/studio/actions";

export const metadata: Metadata = { title: "Finished Work" };

export default async function StudioJobPage({ params, searchParams }: PageProps<"/studio/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireContext();
  const orgId = ctx.organization.id;
  const job = await db().productionJobs.get(orgId, id);
  if (!job) notFound();
  const [execs, artifacts] = await Promise.all([AIExecutiveRegistry.getAllExecutives(orgId), db().artifacts.list(orgId, { where: { job_id: id }, orderBy: "version", desc: true })]);
  const map = new Map(execs.map((e) => [e.id, e]));
  const v = typeof sp.v === "string" ? Number(sp.v) : null;
  const current = artifacts.find((a) => a.version === v) ?? artifacts[0];
  const working = ["QUEUED", "ROUTING", "IN_PROGRESS", "REVISION_REQUESTED"].includes(job.status);

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
      <AutoRefresh active={working} />
      <div className="min-w-0">
        <Link href="/studio" className="text-xs text-ivory-muted hover:text-ivory">← C-Suite Studio</Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="gold">{job.artifact_type}</Badge>
          <Badge tone={job.status === "FAILED" ? "risk" : job.status === "COMPLETED" ? "ok" : "warn"}>{job.status.replace(/_/g, " ")}</Badge>
          {current?.simulated && <SimulatedBadge />}
        </div>
        <h1 className="mt-3 font-heading text-3xl font-semibold sm:text-4xl">{job.title}</h1>
        <p className="mt-2 text-sm text-ivory-muted">“{job.request}”</p>

        <div className="mt-8">
          {working && (
            <div className="plate flex items-center gap-4 p-6">
              <Loader2 className="size-5 animate-spin text-gold-300" />
              <div><p className="text-sm font-medium">{map.get(job.lead_executive_id)?.title} is leading this work{job.status === "REVISION_REQUESTED" ? " — revising" : ""}.</p><p className="text-xs text-ivory-muted">This page updates automatically.</p></div>
            </div>
          )}
          {job.status === "FAILED" && (
            <Alert tone="risk">
              The lead executive could not complete this work{typeof job.metadata?.error === "string" ? `: ${job.metadata.error}` : "."}
              <form action={retryJobAction} className="mt-2"><input type="hidden" name="id" value={job.id} /><button className="inline-flex items-center gap-1 underline"><RotateCcw className="size-3" /> Retry</button></form>
            </Alert>
          )}
          {current && (
            <article className="surface mt-4 p-6 sm:p-8">
              <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
                <span className="font-mono text-[10px] tracking-[0.2em] text-ivory-faint">VERSION {current.version} · {formatRelative(current.created_at).toUpperCase()}</span>
                <a href={`/api/studio/${job.id}/export?v=${current.version}`} className="inline-flex items-center gap-1.5 text-xs text-gold-300 hover:text-gold-200"><Download className="size-3.5" /> Export .md</a>
              </div>
              {current.revision_note && <p className="mb-4 rounded-xl border border-line bg-white/[0.02] px-3 py-2 text-xs text-ivory-muted">Revision requested: {current.revision_note}</p>}
              <Markdown>{current.content}</Markdown>
            </article>
          )}
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <SectionTitle>Lead executive</SectionTitle>
          <ExecChip exec={map.get(job.lead_executive_id)} size={32} />
          {job.contributor_executive_ids.length > 0 && (
            <>
              <p className="mt-4 font-mono text-[10px] tracking-[0.18em] text-ivory-faint">CONTRIBUTORS</p>
              <div className="mt-2 flex flex-wrap gap-3">{job.contributor_executive_ids.map((c) => <ExecChip key={c} exec={map.get(c)} />)}</div>
            </>
          )}
        </Card>
        {artifacts.length > 0 && (
          <Card>
            <SectionTitle>Version history</SectionTitle>
            <ul className="space-y-1">
              {artifacts.map((a) => (
                <li key={a.id}><Link href={`/studio/${job.id}?v=${a.version}`} className={`flex justify-between rounded-lg px-2 py-1.5 text-sm ${a.id === current?.id ? "bg-white/[0.05]" : "hover:bg-white/[0.02]"}`}><span>v{a.version}{a.revision_note ? " · revised" : ""}</span><span className="font-mono text-[10px] text-ivory-faint">{formatRelative(a.created_at)}</span></Link></li>
              ))}
            </ul>
          </Card>
        )}
        {current && !working && (
          <Card className="space-y-3">
            <SectionTitle>Review</SectionTitle>
            <form action={requestRevisionAction} className="space-y-2">
              <input type="hidden" name="id" value={job.id} />
              <label htmlFor="rev" className="sr-only">Revision request</label>
              <Textarea id="rev" name="note" rows={3} placeholder="Request a revision…" required />
              <Button size="sm" variant="outline" className="w-full">Request revision</Button>
            </form>
            {job.status !== "COMPLETED" && <form action={approveJobAction}><input type="hidden" name="id" value={job.id} /><Button size="sm" className="w-full">Approve as Finished Work</Button></form>}
            <form action={saveAsReportAction}><input type="hidden" name="id" value={job.id} /><Button size="sm" variant="outline" className="w-full">Save as Report</Button></form>
            <ButtonLink href={`/sessions/new?objective=${encodeURIComponent(`Review: ${job.title}`)}`} size="sm" variant="ghost" className="w-full">Bring to C-Suite Session</ButtonLink>
            <ButtonLink href={`/comms?compose=1`} size="sm" variant="ghost" className="w-full">Attach to Executive Comms</ButtonLink>
          </Card>
        )}
      </aside>
    </div>
  );
}
