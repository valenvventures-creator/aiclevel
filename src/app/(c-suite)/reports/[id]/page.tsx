import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Printer } from "lucide-react";
import { ExecChip } from "@/components/hq/widgets";
import { Markdown } from "@/components/ui/markdown";
import { Badge, Card, SectionTitle, SimulatedBadge } from "@/components/ui/primitives";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { requireContext } from "@/server/organizations/service";

export const metadata: Metadata = { title: "Report" };

export default async function ReportPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const ctx = await requireContext();
  const r = await db().reports.get(ctx.organization.id, id);
  if (!r) notFound();
  const map = new Map((await AIExecutiveRegistry.getAllExecutives(ctx.organization.id)).map((e) => [e.id, e]));
  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_300px]">
      <article className="min-w-0">
        <Link href="/reports" className="text-xs text-ivory-muted hover:text-ivory">← Reports</Link>
        <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone="gold">{r.report_type}</Badge><Badge>v{r.version}</Badge>{r.simulated && <SimulatedBadge />}</div>
        <h1 className="mt-3 font-heading text-3xl font-semibold sm:text-4xl">{r.title}</h1>
        <p className="mt-2 text-sm text-ivory-muted">{r.summary}</p>
        <div className="surface mt-8 p-6 sm:p-8"><Markdown>{r.content}</Markdown></div>
      </article>
      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <SectionTitle>Lead executive</SectionTitle>
          <ExecChip exec={map.get(r.lead_executive_id)} size={32} />
          {r.contributing_executive_ids.length > 0 && <div className="mt-4 flex flex-wrap gap-3">{r.contributing_executive_ids.map((c) => <ExecChip key={c} exec={map.get(c)} />)}</div>}
          <p className="mt-4 font-mono text-[10px] text-ivory-faint">{new Date(r.created_at).toLocaleString()}</p>
          {r.source_session_id && <Link href={`/sessions/${r.source_session_id}`} className="mt-2 block text-xs text-gold-300">Source C-Suite Session →</Link>}
        </Card>
        <Card>
          <SectionTitle>Sources</SectionTitle>
          {r.sources.length ? <ul className="space-y-1 text-sm">{r.sources.map((s, i) => <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-gold-300">{s.label}</a> : s.label}</li>)}</ul> : <p className="text-xs text-ivory-faint">No external sources cited.</p>}
        </Card>
        <Card>
          <SectionTitle>Export</SectionTitle>
          <a href={`/api/reports/${r.id}/export`} className="block text-sm text-gold-300 hover:text-gold-200">Download Markdown</a>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ivory-faint"><Printer className="size-3" /> Use your browser&apos;s Print → Save as PDF. DOCX export is on the roadmap.</p>
        </Card>
      </aside>
    </div>
  );
}
