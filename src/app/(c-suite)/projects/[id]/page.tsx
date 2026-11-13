import Link from "next/link";
import { listCompanyFiles } from "@/server/files/service";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DecisionCard, Empty, ProductionJobCard, ReportPreview, SessionPreview, Widget } from "@/components/hq/widgets";
import { MapPin } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { ProjectForm } from "@/components/files/project-form";
import { ProjectsMap } from "@/components/projects/projects-map";
import { can } from "@/server/auth/permissions";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { requireContext } from "@/server/organizations/service";
import { canView } from "@/server/memory/retrieval";

export const metadata: Metadata = { title: "Project" };

const STATUS_LABEL = { ACTIVE: "Active", ON_HOLD: "On hold", COMPLETED: "Completed", ARCHIVED: "Archived" } as const;

export default async function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const editOpen = (await searchParams).edit === "1";
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
  const pin =
    typeof project.latitude === "number" && typeof project.longitude === "number"
      ? { id: project.id, name: project.name, status: project.status, location: project.location_label ?? null, latitude: project.latitude, longitude: project.longitude, imageUrl: project.image_file_id ? `/api/projects/images/${project.image_file_id}` : null }
      : null;
  return (
    <div className="space-y-6">
      <header>
        <Link href="/projects" className="text-xs text-ivory-muted hover:text-ivory">← Projects</Link>
        {project.image_file_id ? (
          <div className="relative mt-3 overflow-hidden rounded-3xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- authorized, per-organization image route */}
            <img src={`/api/projects/images/${project.image_file_id}`} alt="" className="h-56 w-full object-cover md:h-72" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
              <Badge tone={project.status === "ACTIVE" ? "ok" : "neutral"}>{STATUS_LABEL[project.status]}</Badge>
              <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">{project.name}</h1>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3"><Badge tone={project.status === "ACTIVE" ? "ok" : "neutral"}>{STATUS_LABEL[project.status]}</Badge></div>
            <h1 className="mt-3 font-heading text-4xl font-semibold">{project.name}</h1>
          </>
        )}
        {project.location_label && <p className="mt-3 flex items-center gap-1.5 text-sm text-gold-200"><MapPin className="size-4 shrink-0" aria-hidden /> {project.location_label}</p>}
        <p className="mt-2 max-w-3xl text-sm text-ivory-muted">{project.description}</p>
      </header>
      {pin && (
        <section aria-label="Project location">
          <ProjectsMap pins={[pin]} height={280} label={`Map: ${project.name}`} zoom={14} />
          <p className="mt-2 text-xs text-ivory-faint"><Link href="/projects?view=map" className="text-gold-300 hover:text-gold-200">See all projects on the map →</Link></p>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="Decisions"><div className="space-y-2.5">{decisions.length ? decisions.map((x) => <DecisionCard key={x.id} d={x} />) : <Empty>No decisions yet.</Empty>}</div></Widget>
        <Widget title="C-Level Sessions"><div className="space-y-2.5">{sessions.length ? sessions.map((s) => <SessionPreview key={s.id} s={s} execs={map} />) : <Empty>No sessions yet.</Empty>}</div></Widget>
        <Widget title="C-Level Memory"><ul className="space-y-2">{memory.filter((m) => canView(m, ctx.role)).map((m) => <li key={m.id}><Link href={`/memory?id=${m.id}`} className="text-sm hover:text-gold-200">{m.title}</Link><p className="text-xs text-ivory-muted">{m.content.slice(0, 120)}</p></li>)}{!memory.length && <Empty>No project memory.</Empty>}</ul></Widget>
        <Widget title="Studio work"><div className="space-y-1">{jobs.length ? jobs.map((j) => <ProductionJobCard key={j.id} j={j} execs={map} />) : <Empty>No Studio work.</Empty>}</div></Widget>
        <Widget title="Reports"><div className="space-y-2.5">{reports.length ? reports.map((r) => <ReportPreview key={r.id} r={r} execs={map} />) : <Empty>No reports.</Empty>}</div></Widget>
        <Widget title="Files & conversations"><ul className="space-y-2 text-sm">{files.map((f) => <li key={f.id}><Link href={`/files#${f.id}`} className="hover:text-gold-200">{f.filename}</Link></li>)}{convs.map((c) => <li key={c.id}><Link href={`/executives/${map.get(c.executive_id)?.slug}?tab=conversation&c=${c.id}`} className="hover:text-gold-200">Conversation: {c.title}</Link></li>)}{!files.length && !convs.length && <Empty>Nothing attached yet.</Empty>}</ul></Widget>
      </div>
      {can(ctx.role, "projects.manage") && (
        <Card id="edit" className="scroll-mt-24">
          <details open={editOpen}>
            <summary className="cursor-pointer list-none font-heading text-lg font-semibold">Edit project <span className="ml-2 text-xs font-normal text-ivory-faint">name, status, image and location</span></summary>
            <div className="mt-4 max-w-2xl"><ProjectForm project={project} /></div>
          </details>
        </Card>
      )}
    </div>
  );
}
