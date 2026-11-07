import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireContext } from "@/server/organizations/service";
import { db } from "@/server/db/store";
import { canView } from "@/server/memory/retrieval";
import { can } from "@/server/auth/permissions";
import { truncate } from "@/lib/utils";

/**
 * Global search across the organization's intelligence. Tenant-scoped and
 * permission-aware. (Supabase deployments should back this with the
 * `search_document` tsvector columns defined in the migrations.)
 */
export async function GET(req: Request) {
  try {
    const ctx = await requireContext();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
    if (q.length < 2) return NextResponse.json({ results: [] });
    const orgId = ctx.organization.id;
    const d = db();
    const has = (...s: (string | null | undefined)[]) => s.some((x) => x?.toLowerCase().includes(q));
    const [execs, convs, comms, sessions, memory, files, reports, projects, jobs, decisions] = await Promise.all([
      d.executives.list(orgId), d.conversations.list(orgId, { where: { user_id: ctx.user.id }, limit: 300 }), d.communications.list(orgId, { limit: 500 }), d.sessions.list(orgId, { limit: 300 }),
      can(ctx.role, "memory.read") ? d.memory.list(orgId, { limit: 1000 }) : [], d.files.list(orgId, { limit: 500 }), d.reports.list(orgId, { limit: 300 }), d.projects.list(orgId), d.productionJobs.list(orgId, { limit: 300 }), d.decisions.list(orgId, { limit: 300 }),
    ]);
    const results = [
      ...execs.filter((e) => has(e.title, e.functional_mandate, e.short_title)).map((e) => ({ type: "Executive", id: e.id, title: e.title, snippet: e.functional_mandate, href: `/executives/${e.slug}` })),
      ...convs.filter((c) => has(c.title)).map((c) => ({ type: "Conversation", id: c.id, title: c.title, snippet: "Executive conversation", href: `/executives/${execs.find((e) => e.id === c.executive_id)?.slug}?tab=conversation&c=${c.id}` })),
      ...comms.filter((c) => (c.sender_id === ctx.user.id || c.recipient_user_ids.includes(ctx.user.id)) && has(c.subject, c.body)).map((c) => ({ type: "Executive Comms", id: c.id, title: c.subject, snippet: truncate(c.body, 80), href: `/comms?thread=${c.thread_id}` })),
      ...sessions.filter((s) => has(s.title, s.objective)).map((s) => ({ type: "C-Suite Session", id: s.id, title: s.title, snippet: truncate(s.objective, 80), href: `/sessions/${s.id}` })),
      ...memory.filter((m) => canView(m, ctx.role) && m.status !== "ARCHIVED" && has(m.title, m.content)).map((m) => ({ type: "Memory", id: m.id, title: m.title, snippet: truncate(m.content, 80), href: `/memory?id=${m.id}` })),
      ...files.filter((f) => has(f.filename, f.extracted_text)).map((f) => ({ type: "File", id: f.id, title: f.filename, snippet: f.category, href: `/files#${f.id}` })),
      ...reports.filter((r) => has(r.title, r.summary)).map((r) => ({ type: "Report", id: r.id, title: r.title, snippet: r.report_type, href: `/reports/${r.id}` })),
      ...projects.filter((p) => has(p.name, p.description)).map((p) => ({ type: "Project", id: p.id, title: p.name, snippet: truncate(p.description, 80), href: `/projects/${p.id}` })),
      ...jobs.filter((j) => has(j.title, j.request)).map((j) => ({ type: "Studio", id: j.id, title: j.title, snippet: j.artifact_type, href: `/studio/${j.id}` })),
      ...decisions.filter((x) => has(x.title, x.question, x.recommendation)).map((x) => ({ type: "Decision", id: x.id, title: x.title, snippet: truncate(x.recommendation, 80), href: `/decisions#${x.id}` })),
    ].slice(0, 25);
    return NextResponse.json({ results });
  } catch (err) {
    return apiError(err);
  }
}
