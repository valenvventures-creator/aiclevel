import Link from "next/link";
import type { Metadata } from "next";
import { FolderKanban, LayoutGrid, Map as MapIcon, MapPin } from "lucide-react";
import { ProjectForm } from "@/components/files/project-form";
import { ProjectsMap, type MapPin as Pin } from "@/components/projects/projects-map";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { cn, formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { requireContext } from "@/server/organizations/service";
import { can } from "@/server/auth/permissions";
import { mappable } from "@/server/projects/service";

export const metadata: Metadata = { title: "Projects" };

const STATUS_LABEL = { ACTIVE: "Active", ON_HOLD: "On hold", COMPLETED: "Completed", ARCHIVED: "Archived" } as const;

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const ctx = await requireContext();
  const view = (await searchParams).view === "map" ? "map" : "cards";
  const projects = await db().projects.list(ctx.organization.id, { orderBy: "created_at", desc: true });
  const located = mappable(projects);
  const pins: Pin[] = located.map((p) => ({ id: p.id, name: p.name, status: p.status, location: p.location_label ?? null, latitude: p.latitude, longitude: p.longitude, imageUrl: p.image_file_id ? `/api/projects/images/${p.image_file_id}` : null }));
  const unlocated = projects.filter((p) => typeof p.latitude !== "number" || typeof p.longitude !== "number");
  const canManage = can(ctx.role, "projects.manage");

  const toggle = (
    <div className="inline-flex rounded-full border border-line-strong p-1" role="tablist" aria-label="Projects view">
      {([["cards", "Cards", LayoutGrid], ["map", "Map", MapIcon]] as const).map(([k, label, Icon]) => (
        <Link key={k} href={k === "map" ? "/projects?view=map" : "/projects"} role="tab" aria-selected={view === k} className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition", view === k ? "bg-gold-400/15 text-gold-100" : "text-ivory-muted hover:text-ivory")}>
          <Icon className="size-4" aria-hidden /> {label}
        </Link>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow="Projects" title="Project workspaces" description="See every conversation, session, file, memory, report, Studio job and decision for one initiative in one place — and where your projects are on the map." actions={projects.length > 0 ? toggle : undefined} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          {projects.length === 0 ? (
            <EmptyState icon={<FolderKanban className="size-5" />} title="No projects yet." body="Create a project to group intelligence around an initiative. Add a location to see it on the map." />
          ) : view === "map" ? (
            <>
              <ProjectsMap pins={pins} height={520} />
              <p className="text-xs text-ivory-faint">
                {pins.length} of {projects.length} {projects.length === 1 ? "project is" : "projects are"} on the map. Click a pin for details.
              </p>
              {unlocated.length > 0 && (
                <Card>
                  <SectionTitle>Not on the map yet</SectionTitle>
                  <ul className="divide-y divide-line">
                    {unlocated.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 truncate hover:text-gold-200">{p.name}</Link>
                        {canManage && <Link href={`/projects/${p.id}?edit=1#edit`} className="shrink-0 text-xs text-gold-300 hover:text-gold-200">Add location</Link>}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="plate block h-full overflow-hidden transition hover:-translate-y-0.5">
                    {p.image_file_id && (
                      // eslint-disable-next-line @next/next/no-img-element -- authorized, per-organization image route
                      <img src={`/api/projects/images/${p.image_file_id}`} alt="" loading="lazy" className="h-36 w-full object-cover" />
                    )}
                    <div className="p-5">
                      <Badge tone={p.status === "ACTIVE" ? "ok" : "neutral"}>{STATUS_LABEL[p.status]}</Badge>
                      <h2 className="mt-3 font-heading text-xl font-semibold">{p.name}</h2>
                      {p.location_label && <p className="mt-1 flex items-center gap-1 truncate text-xs text-gold-200/90"><MapPin className="size-3 shrink-0" aria-hidden /> <span className="truncate">{p.location_label}</span></p>}
                      <p className="mt-1 line-clamp-3 text-sm text-ivory-muted">{p.description}</p>
                      <p className="mt-3 font-mono text-[10px] text-ivory-faint">{formatRelative(p.created_at)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {canManage && <Card className="self-start"><SectionTitle>New project</SectionTitle><ProjectForm /></Card>}
      </div>
    </div>
  );
}
