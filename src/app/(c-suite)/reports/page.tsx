import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";
import { ReportPreview } from "@/components/hq/widgets";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { requireContext } from "@/server/organizations/service";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const [reports, execs] = await Promise.all([db().reports.list(ctx.organization.id, { orderBy: "created_at", desc: true }), AIExecutiveRegistry.getAllExecutives(ctx.organization.id)]);
  const type = typeof sp.type === "string" ? sp.type : "";
  const list = type ? reports.filter((r) => r.report_type === type) : reports;
  const map = new Map(execs.map((e) => [e.id, e]));
  return (
    <div>
      <PageHeader eyebrow="Reports" title="Executive briefs & reports" description="Briefs, reviews, minutes and decision memos — each with a lead executive, contributors, version and export." actions={<ButtonLink href="/studio?preset=report"><Plus className="size-4" /> Generate report</ButtonLink>} />
      {list.length === 0 ? (
        <EmptyState icon={<FileText className="size-5" />} title="No reports yet." body="Request a report from any executive or create minutes from a C-Suite Session." action={<ButtonLink href="/studio" size="sm">Open Studio</ButtonLink>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((r) => <ReportPreview key={r.id} r={r} execs={map} />)}</div>
      )}
    </div>
  );
}
