import Link from "next/link";
import { listCompanyFiles } from "@/server/files/service";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DecisionCard, Empty, ProductionJobCard, ReportPreview, SessionPreview, Widget } from "@/components/hq/widgets";
import { Badge } from "@/components/ui/primitives";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { requireContext } from "@/server/organizations/service";
import { canView } from "@/server/memory/retrieval";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const ctx = await requireContext();
  const orgId = ctx.organization.id;
  const d = db();
  const project = await d.projects.get(orgId, id);
  if (!project) notFound();
  const w = { where: { project_id: id } };
  const [execs, sessions, memory, files, reports, jobs, decisions, convs] = await Promise.all([
    AIExecutiveRegistry.getAllExecutives(orgId), d.sessions.list(orgId, w), d.memory.list(orgId, w), listCompanyFiles(orgId, { projectId: id }), d.reports.list(orgId, w), d.productionJobs.list(orgId, w), d.decisions.list(orgId, w), d.conversations.list(orgId, { where: { project_id: id, user_id: ctx.user.id } }),
  ]);
  const map = new Map(execs.map((e) => [e.id, e]));
  return (
    <div className="space-y-6">
      <header>
        <Link href="/projects" className="text-xs text-ivory-muted hover:text-ivory">← Projects</Link>
        <div className="mt-3"><Badge tone="ok">{project.status}</Badge></div>
        <h1 className="mt-3 font-heading text-4xl font-semibold">{project.name}</h1>
        <p className="mt-2 max-w-3xl text-sm text-ivory-muted">{project.description}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="Decisions"><div className="space-y-2.5">{decisions.length ? decisions.map((x) => <DecisionCard key={x.id} d={x} />) : <Empty>No decisions yet.</Empty>}</div></Widget>
        <Widget title="C-Level Sessions"><div className="space-y-2.5">{sessions.length ? sessions.map((s) => <SessionPreview key={s.id} s={s} execs={map} />) : <Empty>No sessions yet.</Empty>}</div></Widget>
        <Widget title="C-Level Memory"><ul className="space-y-2">{memory.filter((m) => canView(m, ctx.role)).map((m) => <li key={m.id}><Link href={`/memory?id=${m.id}`} className="text-sm hover:text-gold-200">{m.title}</Link><p className="text-xs text-ivory-muted">{m.content.slice(0, 120)}</p></li>)}{!memory.length && <Empty>No project memory.</Empty>}</ul></Widget>
        <Widget title="Studio work"><div className="space-y-1">{jobs.length ? jobs.map((j) => <ProductionJobCard key={j.id} j={j} execs={map} />) : <Empty>No Studio work.</Empty>}</div></Widget>
        <Widget title="Reports"><div className="space-y-2.5">{reports.length ? reports.map((r) => <ReportPreview key={r.id} r={r} execs={map} />) : <Empty>No reports.</Empty>}</div></Widget>
        <Widget title="Files & conversations"><ul className="space-y-2 text-sm">{files.map((f) => <li key={f.id}><Link href={`/files#${f.id}`} className="hover:text-gold-200">{f.filename}</Link></li>)}{convs.map((c) => <li key={c.id}><Link href={`/executives/${map.get(c.executive_id)?.slug}?tab=conversation&c=${c.id}`} className="hover:text-gold-200">Conversation: {c.title}</Link></li>)}{!files.length && !convs.length && <Empty>Nothing attached yet.</Empty>}</ul></Widget>
      </div>
    </div>
  );
}
