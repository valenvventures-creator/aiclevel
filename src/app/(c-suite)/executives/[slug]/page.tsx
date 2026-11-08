import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileText, Mail, MessageSquare, Plus, Settings2, Users, Volume2, Workflow } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { ExecutiveConversation, type UIMessage } from "@/components/conversations/executive-conversation";
import { LibraryTab } from "@/components/executives/library-tab";
import { LearningTab } from "@/components/executives/learning-tab";
import { ReportPreview, ProductionJobCard, Empty } from "@/components/hq/widgets";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
import { cn, formatBytes, formatRelative } from "@/lib/utils";
import { TOOL_REGISTRY } from "@/config/tools/registry";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { requireContext } from "@/server/organizations/service";
import { can } from "@/server/auth/permissions";

const TABS = [
  ["conversation", "Conversation"],
  ["profile", "Executive Profile"],
  ["library", "Library"],
  ["learning", "Learning"],
  ["reports", "Reports"],
  ["files", "Files"],
  ["activity", "Activity"],
] as const;

const SUGGESTIONS: Record<string, string[]> = {
  CEO: ["What should our top three priorities be this quarter?", "Prepare today's CEO brief.", "Where are we most misaligned?"],
  CFO: ["How much runway do we have under the hiring plan?", "Stress-test our fundraising plan.", "What's our biggest financial risk?"],
  CCO: ["Draft positioning for our Enterprise tier.", "What story should we tell investors?", "Critique our current brand voice."],
  CHRO: ["Who should own SOC 2 access reviews?", "Design our weekly operating cadence.", "Draft a job description for a CS lead."],
  CTO: ["Where can AI automation save us the most time?", "Review our security posture.", "Build vs buy for our analytics stack?"],
  CLO: ["What are the risks in the Meridian channel terms?", "Review our decision governance.", "What should we document before the board meeting?"],
  CIO: ["Design a measurable giving program.", "How do we report impact credibly?", "Which community partners fit our mission?"],
};

export async function generateMetadata({ params }: PageProps<"/executives/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") };
}

export default async function ExecutiveOfficePage({ params, searchParams }: PageProps<"/executives/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const tab = (typeof sp.tab === "string" && TABS.some(([k]) => k === sp.tab) ? sp.tab : "conversation") as (typeof TABS)[number][0];
  const ctx = await requireContext();
  const orgId = ctx.organization.id;
  const exec = await AIExecutiveRegistry.resolve(orgId, slug);
  if (!exec) notFound();
  const all = await AIExecutiveRegistry.getAllExecutives(orgId);
  const personas = await db().personas.list(orgId);
  const pq = new Map(personas.map((p) => [p.executive_id, p.primary_question]));
  const lite = (e: (typeof all)[number]) => ({ id: e.id, slug: e.slug, title: e.title, short_title: e.short_title, avatar_url: e.avatar_url, accent: e.accent, primary_question: pq.get(e.id) ?? "" });
  const execMap = new Map(all.map((e) => [e.id, e]));
  const waitingLessons = (await db().lessons.list(orgId, { where: { executive_id: exec.id, status: "PROPOSED" } })).length;

  return (
    <div>
      {/* Header */}
      <header className="plate relative mb-6 overflow-hidden p-6 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full opacity-20 blur-3xl" style={{ background: exec.accent }} />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
          <ExecutiveAvatar src={exec.avatar_url} shortTitle={exec.short_title} accent={exec.accent} size={96} status={exec.status} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Executive Office · {String(exec.sort_order).padStart(2, "0")}</p>
            <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">{exec.display_name ?? exec.title}</h1>
            <p className="mt-1 text-sm font-medium uppercase tracking-[0.14em]" style={{ color: exec.accent }}>{exec.functional_mandate}</p>
            <p className="mt-3 max-w-3xl text-sm text-ivory-muted">{exec.description}</p>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-2">
          <ButtonLink href={`/executives/${exec.slug}?tab=conversation`} size="sm"><MessageSquare className="size-3.5" /> Start conversation</ButtonLink>
          <ButtonLink href={`/comms?compose=1&to=${exec.id}`} size="sm" variant="outline"><Mail className="size-3.5" /> Send message</ButtonLink>
          <ButtonLink href={`/studio?lead=${exec.role_code}&preset=report`} size="sm" variant="outline"><FileText className="size-3.5" /> Request report</ButtonLink>
          <ButtonLink href={`/sessions/new?with=${exec.id}`} size="sm" variant="outline"><Users className="size-3.5" /> Add to C-Suite Session</ButtonLink>
          <ButtonLink href={`/studio?lead=${exec.role_code}`} size="sm" variant="outline"><Workflow className="size-3.5" /> Assign work</ButtonLink>
          <ButtonLink href={`/settings/voice#${exec.slug}`} size="sm" variant="ghost"><Volume2 className="size-3.5" /> Voice</ButtonLink>
        </div>
      </header>

      {/* Tabs */}
      <nav aria-label="Executive Office sections" className="scrollbar-thin mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/executives/${exec.slug}?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={cn("relative whitespace-nowrap px-4 py-3 text-sm transition", tab === k ? "text-gold-200" : "text-ivory-muted hover:text-ivory")}>
            {label}
            {k === "learning" && waitingLessons > 0 && <span className="ml-1.5 rounded-full bg-gold-400/15 px-1.5 py-0.5 font-mono text-[10px] text-gold-200" aria-label={`${waitingLessons} lessons waiting for approval`}>{waitingLessons}</span>}
            {tab === k && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-gold-400" />}
          </Link>
        ))}
      </nav>

      {tab === "conversation" && <ConversationTab ctx={ctx} exec={exec} others={all.filter((e) => e.id !== exec.id).map(lite)} cParam={typeof sp.c === "string" ? sp.c : null} lite={lite(exec)} />}
      {tab === "profile" && <ProfileTab exec={exec} canConfigure={can(ctx.role, "executives.configure")} />}
      {tab === "library" && <LibraryTab orgId={orgId} exec={exec} canConfigure={can(ctx.role, "executives.configure")} />}
      {tab === "learning" && <LearningTab orgId={orgId} exec={exec} canConfigure={can(ctx.role, "executives.configure")} />}
      {tab === "reports" && <ReportsTab orgId={orgId} execId={exec.id} execMap={execMap} roleCode={exec.role_code} />}
      {tab === "files" && <FilesTab orgId={orgId} />}
      {tab === "activity" && <ActivityTab orgId={orgId} execId={exec.id} execMap={execMap} />}
    </div>
  );
}

async function ConversationTab({ ctx, exec, others, cParam, lite }: { ctx: Awaited<ReturnType<typeof requireContext>>; exec: NonNullable<Awaited<ReturnType<typeof AIExecutiveRegistry.resolve>>>; others: Parameters<typeof ExecutiveConversation>[0]["others"]; cParam: string | null; lite: Parameters<typeof ExecutiveConversation>[0]["exec"] }) {
  const orgId = ctx.organization.id;
  const convs = await db().conversations.list(orgId, { where: { executive_id: exec.id, user_id: ctx.user.id }, orderBy: "updated_at", desc: true, limit: 30 });
  const active = cParam === "new" ? null : (convs.find((c) => c.id === cParam) ?? (cParam ? null : convs[0] ?? null));
  const rows = active ? await db().messages.list(orgId, { where: { conversation_id: active.id }, orderBy: "created_at" }) : [];
  // This person's earlier ratings, so the 👍/👎 show as they left them.
  const ratings = new Map(rows.length ? (await db().feedback.list(orgId, { where: { executive_id: exec.id, created_by: ctx.user.id } })).map((f) => [f.source_id, f.rating]) : []);
  const messages: UIMessage[] = rows.map((m) => ({ id: m.id, role: m.role, content: m.content, simulated: m.simulated, model: m.model, rating: ratings.get(m.id) ?? null }));
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="order-2 lg:order-1" aria-label="Conversations">
        <ButtonLink href={`/executives/${exec.slug}?tab=conversation&c=new`} variant="outline" size="sm" className="w-full"><Plus className="size-3.5" /> New conversation</ButtonLink>
        <ul className="mt-3 space-y-1">
          {convs.length === 0 && <li className="px-2 py-4 text-xs text-ivory-faint">No conversations yet.</li>}
          {convs.map((c) => (
            <li key={c.id}>
              <Link href={`/executives/${exec.slug}?tab=conversation&c=${c.id}`} aria-current={active?.id === c.id ? "true" : undefined} className={cn("block rounded-lg px-3 py-2 text-sm transition", active?.id === c.id ? "bg-white/[0.05] text-ivory" : "text-ivory-muted hover:bg-white/[0.02] hover:text-ivory")}>
                <span className="block truncate">{c.title}</span>
                <span className="font-mono text-[10px] text-ivory-faint">{formatRelative(c.updated_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <div className="order-1 min-w-0 lg:order-2">
        <ExecutiveConversation key={active?.id ?? "new"} exec={lite} others={others} conversationId={active?.id ?? null} initialMessages={messages} canWrite={can(ctx.role, "conversations.create")} canRate={can(ctx.role, "executives.use")} suggestions={SUGGESTIONS[exec.role_code] ?? []} />
      </div>
    </div>
  );
}

function ProfileTab({ exec, canConfigure }: { exec: NonNullable<Awaited<ReturnType<typeof AIExecutiveRegistry.resolve>>>; canConfigure: boolean }) {
  const p = exec.persona;
  const rows: [string, string][] = [
    ["North star", p.north_star], ["Core belief", p.core_belief], ["Leadership promise", p.leadership_promise], ["Biography", p.biography],
    ["Personality", p.personality], ["Communication style", p.communication_style], ["Decision style", p.decision_style], ["Reasoning framework", p.reasoning_guidelines], ["Risk constraints", p.risk_constraints],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <SectionTitle action={canConfigure && <ButtonLink href={`/settings/c-suite/${exec.slug}`} size="sm" variant="ghost"><Settings2 className="size-3.5" /> Configure</ButtonLink>}>Executive Profile</SectionTitle>
        <blockquote className="mb-6 border-l-2 border-gold-500 pl-4 font-accent text-xl italic">“{p.primary_question.replace(/[“”"]/g, "")}”</blockquote>
        <dl className="grid gap-5 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className={k === "Biography" ? "sm:col-span-2" : ""}>
              <dt className="font-mono text-[10px] tracking-[0.18em] text-ivory-faint">{k.toUpperCase()}</dt>
              <dd className="mt-1 text-sm leading-relaxed">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="space-y-6">
        <Card>
          <SectionTitle>Specialties</SectionTitle>
          <ul className="space-y-3">
            {exec.skills.map((s) => (
              <li key={s.id}><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-ivory-muted">{s.description}</p></li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Authorized tools</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {exec.model.tool_permissions.map((t) => <Badge key={t} tone="neutral">{TOOL_REGISTRY[t]?.label ?? t}</Badge>)}
          </div>
          <p className="mt-4 font-mono text-[10px] tracking-[0.18em] text-ivory-faint">MEMORY ACCESS</p>
          <p className="mt-1 text-xs text-ivory-muted">{exec.model.memory_categories === "ALL" ? "All categories" : exec.model.memory_categories.join(", ").toLowerCase()}</p>
          <p className="mt-4 font-mono text-[10px] tracking-[0.18em] text-ivory-faint">ENGINE</p>
          <p className="mt-1 text-xs text-ivory-muted">{exec.model.primary_model} · fallback {exec.model.fallback_model ?? "none"} · prompt {exec.model.prompt_key}_v1</p>
        </Card>
      </div>
    </div>
  );
}

async function ReportsTab({ orgId, execId, execMap, roleCode }: { orgId: string; execId: string; execMap: Map<string, import("@/types/domain").AIExecutive>; roleCode: string }) {
  const [reports, jobs] = await Promise.all([
    db().reports.list(orgId, { where: { lead_executive_id: execId }, orderBy: "created_at", desc: true }),
    db().productionJobs.list(orgId, { where: { lead_executive_id: execId }, orderBy: "created_at", desc: true }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <SectionTitle action={<ButtonLink href={`/studio?lead=${roleCode}&preset=report`} size="sm" variant="ghost"><Plus className="size-3.5" /> Request report</ButtonLink>}>Reports led</SectionTitle>
        <div className="space-y-3">{reports.length ? reports.map((r) => <ReportPreview key={r.id} r={r} execs={execMap} />) : <Empty>No reports yet.</Empty>}</div>
      </section>
      <section>
        <SectionTitle>Studio work</SectionTitle>
        <div className="surface space-y-1 p-3">{jobs.length ? jobs.map((j) => <ProductionJobCard key={j.id} j={j} execs={execMap} />) : <Empty>No Studio work assigned.</Empty>}</div>
      </section>
    </div>
  );
}

async function FilesTab({ orgId }: { orgId: string }) {
  const files = await db().files.list(orgId, { orderBy: "created_at", desc: true, limit: 20 });
  return (
    <Card>
      <SectionTitle action={<ButtonLink href="/files?upload=1" size="sm" variant="ghost"><Plus className="size-3.5" /> Upload</ButtonLink>}>Files available to this executive</SectionTitle>
      {files.length ? (
        <ul className="divide-y divide-line">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <Link href={`/files#${f.id}`} className="truncate hover:text-gold-200">{f.filename}</Link>
              <span className="shrink-0 font-mono text-[10px] text-ivory-faint">{f.category} · {formatBytes(f.size)}</span>
            </li>
          ))}
        </ul>
      ) : <Empty>No files uploaded yet.</Empty>}
    </Card>
  );
}

async function ActivityTab({ orgId, execId, execMap }: { orgId: string; execId: string; execMap: Map<string, import("@/types/domain").AIExecutive> }) {
  const [sessions, comms, usage] = await Promise.all([
    db().sessions.list(orgId, { orderBy: "created_at", desc: true, limit: 50 }),
    db().communications.list(orgId, { where: { sender_id: execId }, orderBy: "created_at", desc: true, limit: 10 }),
    db().usage.list(orgId, { where: { executive_id: execId }, orderBy: "created_at", desc: true, limit: 10 }),
  ]);
  const items = [
    ...sessions.filter((s) => s.participant_executive_ids.includes(execId)).map((s) => ({ at: s.created_at, label: `Participated in C-Suite Session: ${s.title}`, href: `/sessions/${s.id}` })),
    ...comms.map((c) => ({ at: c.created_at, label: `Sent Executive Comms: ${c.subject}`, href: `/comms?thread=${c.thread_id}` })),
    ...usage.map((u) => ({ at: u.created_at, label: `${u.request_type.replace(/_/g, " ")} via ${u.provider}/${u.model}${u.success ? "" : " — failed"}`, href: null })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  void execMap;
  return (
    <Card>
      <SectionTitle>Activity</SectionTitle>
      {items.length ? (
        <ol className="relative space-y-4 border-l border-line pl-5">
          {items.map((i, idx) => (
            <li key={idx} className="relative">
              <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-gold-500" aria-hidden />
              {i.href ? <Link href={i.href} className="text-sm hover:text-gold-200">{i.label}</Link> : <p className="text-sm">{i.label}</p>}
              <p className="font-mono text-[10px] text-ivory-faint">{formatRelative(i.at)}</p>
            </li>
          ))}
        </ol>
      ) : <Empty>No recorded activity yet.</Empty>}
    </Card>
  );
}
