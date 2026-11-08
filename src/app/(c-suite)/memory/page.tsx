import Link from "next/link";
import type { Metadata } from "next";
import { Brain, Pin, Search, ShieldCheck } from "lucide-react";
import { MemoryForm } from "@/components/memory/memory-form";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, type Tone } from "@/components/ui/primitives";
import { cn, formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { listTeam, requireContext } from "@/server/organizations/service";
import { can } from "@/server/auth/permissions";
import { canView, rankMemories } from "@/server/memory/retrieval";
import { memoryOpAction } from "@/server/memory/actions";
import { MEMORY_CATEGORIES, MEMORY_STATUSES, type MemoryRecord } from "@/types/domain";

export const metadata: Metadata = { title: "C-Level Memory" };

const STATUS_TONE: Record<MemoryRecord["status"], Tone> = { VERIFIED: "ok", USER_CONFIRMED: "info", PROPOSED: "warn", SYSTEM_IMPORTED: "neutral", ARCHIVED: "neutral" };
const SOURCE_LABEL: Record<MemoryRecord["source_type"], string> = { HUMAN_ENTRY: "Human entry", UPLOADED_DOCUMENT: "Uploaded document", EXECUTIVE_CONVERSATION: "Executive conversation", CSUITE_SESSION: "C-Level Session", REPORT: "Report", EXTERNAL_INTEGRATION: "External integration", API: "API", RESEARCH: "Research", IMPORT: "Onboarding import" };

export default async function MemoryPage({ searchParams }: PageProps<"/memory">) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = s("q");
  const category = s("category");
  const status = s("status");
  const selectedId = s("id");
  const ctx = await requireContext();
  const orgId = ctx.organization.id;
  const [all, projects, team] = await Promise.all([db().memory.list(orgId, { orderBy: "updated_at", desc: true, limit: 1000 }), db().projects.list(orgId), listTeam(orgId)]);
  const names = new Map(team.map((m) => [m.user_id, m.profile?.first_name]));
  let rows = all.filter((m) => canView(m, ctx.role));
  if (category) rows = rows.filter((m) => m.category === category);
  if (status) rows = rows.filter((m) => m.status === status);
  else rows = rows.filter((m) => m.status !== "ARCHIVED");
  const results = q ? rankMemories(rows, { organizationId: orgId, query: q, viewerRole: ctx.role, limit: 50 }).map((r) => ({ m: r.record, score: r.score })) : rows.sort((a, b) => Number(b.pinned) - Number(a.pinned)).map((m) => ({ m, score: null as number | null }));
  const selected = selectedId ? all.find((m) => m.id === selectedId && canView(m, ctx.role)) : undefined;
  const canWrite = can(ctx.role, "memory.write");
  const link = (p: Record<string, string>) => `/memory?${new URLSearchParams(Object.entries({ q, category, status, ...p }).filter(([, v]) => v))}`;
  const author = (id: string | null) => (id ? (names.get(id) ?? "Team member") : "—");

  return (
    <div>
      <PageHeader eyebrow="C-Level Memory" title="Organizational intelligence" description="Not chat history: facts, decisions, commitments and lessons with provenance. A.I. conclusions arrive as PROPOSED and never become organizational truth until a human confirms them." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <form action="/memory" className="flex items-center gap-2 rounded-full border border-line-strong bg-ink-900/60 px-4" role="search">
            <Search className="size-4 text-gold-300" aria-hidden />
            <label htmlFor="mq" className="sr-only">Search C-Level Memory</label>
            <input id="mq" name="q" defaultValue={q} placeholder="Search memory — e.g. runway, Northwind, SOC 2" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ivory-faint" />
            {category && <input type="hidden" name="category" value={category} />}
            {status && <input type="hidden" name="status" value={status} />}
          </form>
          <div className="flex flex-wrap gap-1.5" aria-label="Filters">
            <Link href={link({ status: "" })} className={cn("rounded-full border px-3 py-1 text-xs", !status ? "border-line-gold text-gold-200" : "border-line text-ivory-muted")}>Active</Link>
            {MEMORY_STATUSES.map((st) => <Link key={st} href={link({ status: st })} className={cn("rounded-full border px-3 py-1 text-xs", status === st ? "border-line-gold text-gold-200" : "border-line text-ivory-muted")}>{st.replace("_", " ").toLowerCase()}</Link>)}
          </div>
          <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
            <Link href={link({ category: "" })} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs", !category ? "border-line-gold text-gold-200" : "border-line text-ivory-muted")}>All categories</Link>
            {MEMORY_CATEGORIES.map((c) => <Link key={c} href={link({ category: c })} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs", category === c ? "border-line-gold text-gold-200" : "border-line text-ivory-muted")}>{c.charAt(0) + c.slice(1).toLowerCase()}</Link>)}
          </div>
          {q && <p className="text-xs text-ivory-faint">Ranked by relevance, recency, importance and verification · lexical retrieval{ctx.organization.is_demo ? " (demo)" : ""}</p>}

          {results.length === 0 ? (
            <EmptyState icon={<Brain className="size-5" />} title={q || category || status ? "No matching memory." : "C-Level Memory is empty."} body="Add facts, decisions and lessons your executives should remember." />
          ) : (
            <ul className="space-y-3">
              {results.map(({ m, score }) => (
                <li key={m.id}>
                  <Link href={link({ id: m.id })} className={cn("surface block p-4 transition hover:border-line-gold", selected?.id === m.id && "border-line-gold")}>
                    <div className="flex flex-wrap items-center gap-2">
                      {m.pinned && <Pin className="size-3.5 text-gold-400" aria-label="Pinned" />}
                      <p className="font-medium">{m.title}</p>
                      <Badge tone={STATUS_TONE[m.status]}>{m.status.replace("_", " ")}</Badge>
                      <Badge>{m.category}</Badge>
                      {score !== null && <span className="ml-auto font-mono text-[10px] text-ivory-faint">relevance {score.toFixed(2)}</span>}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-ivory-muted">{m.content}</p>
                    <p className="mt-2 font-mono text-[10px] text-ivory-faint">{SOURCE_LABEL[m.source_type]} · importance {m.importance}/5 · {formatRelative(m.updated_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {selected ? (
            <Card>
              <SectionTitle action={<Link href={link({ id: "" })} className="text-xs text-ivory-muted">Close</Link>}>Memory inspector</SectionTitle>
              <h2 className="font-heading text-xl font-semibold">{selected.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{selected.content}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
                {[
                  ["Source", SOURCE_LABEL[selected.source_type]],
                  ["Verification", selected.status.replace("_", " ")],
                  ["Created", new Date(selected.created_at).toLocaleDateString()],
                  ["Creator", author(selected.created_by)],
                  ["Verified by", author(selected.verified_by)],
                  ["Confidence", `${Math.round(selected.confidence * 100)}%`],
                  ["Visibility", selected.visibility.replace("_", " ").toLowerCase()],
                  ["Related record", selected.source_id ? selected.source_id.slice(0, 8) : "—"],
                ].map(([k, v]) => (
                  <div key={k}><dt className="font-mono text-[10px] tracking-[0.16em] text-ivory-faint">{k.toUpperCase()}</dt><dd className="mt-0.5">{v}</dd></div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {can(ctx.role, "memory.verify") && selected.status !== "VERIFIED" && <Op id={selected.id} op="verify" label="Verify" icon />}
                {canWrite && <Op id={selected.id} op="pin" label={selected.pinned ? "Unpin" : "Pin"} />}
                {canWrite && <Op id={selected.id} op="archive" label={selected.status === "ARCHIVED" ? "Restore" : "Archive"} />}
                {can(ctx.role, "memory.delete") && <Op id={selected.id} op="delete" label="Delete" danger />}
              </div>
              {canWrite && (
                <details className="mt-4 border-t border-line pt-4">
                  <summary className="cursor-pointer text-sm text-gold-300">Edit</summary>
                  <div className="mt-4"><MemoryForm record={selected} projects={projects} canOwnerOnly={ctx.role === "OWNER"} /></div>
                </details>
              )}
            </Card>
          ) : canWrite ? (
            <Card>
              <SectionTitle>Add to C-Level Memory</SectionTitle>
              <MemoryForm projects={projects} canOwnerOnly={ctx.role === "OWNER"} />
            </Card>
          ) : null}
          <Card>
            <SectionTitle>Memory status</SectionTitle>
            <ul className="space-y-2 text-sm">
              {MEMORY_STATUSES.map((st) => (
                <li key={st} className="flex items-center justify-between"><Badge tone={STATUS_TONE[st]}>{st.replace("_", " ")}</Badge><span className="font-mono text-xs">{all.filter((m) => m.status === st && canView(m, ctx.role)).length}</span></li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Op({ id, op, label, danger, icon }: { id: string; op: string; label: string; danger?: boolean; icon?: boolean }) {
  return (
    <form action={memoryOpAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs", danger ? "border-risk/30 text-risk hover:bg-risk/10" : "border-line-strong hover:border-line-gold")}>
        {icon && <ShieldCheck className="size-3.5" />} {label}
      </button>
    </form>
  );
}
