import type { Metadata } from "next";
import { Workflow } from "lucide-react";
import { StudioRequest } from "@/components/studio/studio-request";
import { ProductionJobCard } from "@/components/hq/widgets";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";
import { STUDIO_CAPABILITIES } from "@/config/studio/capabilities";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { requireContext } from "@/server/organizations/service";
import { can } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "C-Level Studio" };

export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const orgId = ctx.organization.id;
  const [execs, jobs, projects] = await Promise.all([AIExecutiveRegistry.getAllExecutives(orgId), db().productionJobs.list(orgId, { orderBy: "created_at", desc: true }), db().projects.list(orgId)]);
  const map = new Map(execs.map((e) => [e.id, e]));
  const groups = [
    { label: "In production", items: jobs.filter((j) => ["QUEUED", "ROUTING", "IN_PROGRESS", "REVISION_REQUESTED"].includes(j.status)) },
    { label: "Awaiting your review", items: jobs.filter((j) => j.status === "AWAITING_REVIEW") },
    { label: "Finished Work", items: jobs.filter((j) => j.status === "COMPLETED") },
    { label: "Needs attention", items: jobs.filter((j) => j.status === "FAILED") },
  ];
  return (
    <div className="space-y-10">
      <AutoRefresh active={groups[0].items.length > 0} />
      {can(ctx.role, "studio.request") && (
        <StudioRequest
          execs={execs.map((e) => ({ role_code: e.role_code, title: e.title, short_title: e.short_title, avatar_url: e.avatar_url, accent: e.accent }))}
          capabilities={STUDIO_CAPABILITIES.map((c) => ({ key: c.key, label: c.label, lead: c.lead }))}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          defaultLead={typeof sp.lead === "string" ? sp.lead : undefined}
        />
      )}
      {jobs.length === 0 ? (
        <EmptyState icon={<Workflow className="size-5" />} title="No Finished Work yet." body="Your first request will appear here as soon as the lead executive starts on it." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {groups.filter((g) => g.items.length).map((g) => (
            <section key={g.label} className="surface p-5">
              <SectionTitle>{g.label}</SectionTitle>
              <div className="space-y-1">{g.items.map((j) => <ProductionJobCard key={j.id} j={j} execs={map} />)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
