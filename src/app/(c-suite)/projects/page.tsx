import Link from "next/link";
import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";
import { ProjectForm } from "@/components/files/project-form";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { requireContext } from "@/server/organizations/service";
import { can } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const ctx = await requireContext();
  const projects = await db().projects.list(ctx.organization.id, { orderBy: "created_at", desc: true });
  return (
    <div>
      <PageHeader eyebrow="Projects" title="Project workspaces" description="See every conversation, session, file, memory, report, Studio job and decision for one initiative in one place." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {projects.length === 0 ? <EmptyState icon={<FolderKanban className="size-5" />} title="No projects yet." body="Create a project to group intelligence around an initiative." /> : (
          <ul className="grid gap-4 md:grid-cols-2">
            {projects.map((p) => (
              <li key={p.id}><Link href={`/projects/${p.id}`} className="plate block h-full p-5 transition hover:-translate-y-0.5"><Badge tone={p.status === "ACTIVE" ? "ok" : "neutral"}>{p.status.replace("_", " ")}</Badge><h2 className="mt-3 font-heading text-xl font-semibold">{p.name}</h2><p className="mt-1 line-clamp-3 text-sm text-ivory-muted">{p.description}</p><p className="mt-3 font-mono text-[10px] text-ivory-faint">{formatRelative(p.created_at)}</p></Link></li>
            ))}
          </ul>
        )}
        {can(ctx.role, "projects.manage") && <Card className="self-start"><SectionTitle>New project</SectionTitle><ProjectForm /></Card>}
      </div>
    </div>
  );
}
