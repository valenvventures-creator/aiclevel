import Link from "next/link";
import { listCompanyFiles } from "@/server/files/service";
import type { Metadata } from "next";
import { Archive, ArrowLeft, FileEdit, Inbox, Mail, PenSquare, Search, Send, Star } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { ExecutiveCommsComposer } from "@/components/comms/composer";
import { Markdown } from "@/components/ui/markdown";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, SimulatedBadge } from "@/components/ui/primitives";
import { cn, formatRelative, truncate } from "@/lib/utils";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { listTeam, requireContext } from "@/server/organizations/service";
import { deleteDraftAction, updateCommunicationAction } from "@/server/comms/actions";
import type { Communication } from "@/types/domain";

export const metadata: Metadata = { title: "Executive Comms" };

const FOLDERS = [
  { key: "INBOX", label: "Inbox", icon: Inbox },
  { key: "SENT", label: "Sent", icon: Send },
  { key: "STARRED", label: "Starred", icon: Star },
  { key: "DRAFTS", label: "Drafts", icon: FileEdit },
  { key: "ARCHIVED", label: "Archived", icon: Archive },
] as const;

export default async function CommsPage({ searchParams }: PageProps<"/comms">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const folder = (FOLDERS.find((f) => f.key === str("folder"))?.key ?? "INBOX") as (typeof FOLDERS)[number]["key"];
  const threadId = str("thread");
  const compose = str("compose") === "1";
  const q = str("q")?.toLowerCase() ?? "";
  const unreadOnly = str("filter") === "unread";

  const ctx = await requireContext();
  const orgId = ctx.organization.id;
  const d = db();
  const [all, execs, team, reports, sessions, memory, projects, files] = await Promise.all([
    d.communications.list(orgId, { orderBy: "created_at", desc: true, limit: 500 }),
    AIExecutiveRegistry.getAllExecutives(orgId),
    listTeam(orgId),
    d.reports.list(orgId, { orderBy: "created_at", desc: true, limit: 10 }),
    d.sessions.list(orgId, { orderBy: "created_at", desc: true, limit: 10 }),
    d.memory.list(orgId, { orderBy: "updated_at", desc: true, limit: 10 }),
    d.projects.list(orgId, { limit: 10 }),
    listCompanyFiles(orgId, { limit: 10 }),
  ]);
  const execMap = new Map(execs.map((e) => [e.id, e]));
  // Only messages this user sent or received.
  const mine = all.filter((c) => c.sender_id === ctx.user.id || c.recipient_user_ids.includes(ctx.user.id));
  const threads = new Map<string, Communication[]>();
  for (const c of [...mine].reverse()) threads.set(c.thread_id, [...(threads.get(c.thread_id) ?? []), c]);
  const threadList = [...threads.values()]
    .map((msgs) => ({ msgs, last: msgs[msgs.length - 1], first: msgs[0] }))
    .filter(({ msgs, last }) => {
      const archived = last.archived;
      const isDraft = msgs.every((m) => m.is_draft);
      if (folder === "DRAFTS") return isDraft;
      if (isDraft) return false;
      if (folder === "ARCHIVED") return archived;
      if (archived) return false;
      if (folder === "STARRED") return msgs.some((m) => m.starred);
      if (folder === "SENT") return msgs.some((m) => m.sender_id === ctx.user.id);
      return msgs.some((m) => m.sender_type === "EXECUTIVE" || (m.sender_id !== ctx.user.id && m.recipient_user_ids.includes(ctx.user.id)));
    })
    .filter(({ msgs }) => !q || msgs.some((m) => `${m.subject} ${m.body}`.toLowerCase().includes(q)))
    .filter(({ msgs }) => !unreadOnly || msgs.some((m) => !m.read_at))
    .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  const counts = { INBOX: [...threads.values()].filter((m) => m.some((x) => !x.read_at && x.sender_type === "EXECUTIVE" && !x.archived)).length };
  const selected = threadId ? threads.get(threadId) : undefined;

  const composerExecs = execs.map((e) => ({ id: e.id, short_title: e.short_title, title: e.title, avatar_url: e.avatar_url, accent: e.accent }));
  const members = team.filter((m) => m.user_id !== ctx.user.id).map((m) => ({ id: m.user_id, name: m.profile ? `${m.profile.first_name} ${m.profile.last_name}` : "Team member" }));
  const origins = [
    ...reports.map((r) => ({ type: "REPORT", id: r.id, label: r.title })),
    ...sessions.map((s) => ({ type: "SESSION", id: s.id, label: s.title })),
    ...memory.map((m) => ({ type: "MEMORY", id: m.id, label: m.title })),
    ...projects.map((p) => ({ type: "PROJECT", id: p.id, label: p.name })),
    ...files.map((f) => ({ type: "FILE", id: f.id, label: f.filename })),
    { type: "TEMPLATE", id: "weekly-update", label: "Weekly leadership update" },
    { type: "TEMPLATE", id: "decision-request", label: "Decision request" },
  ];
  const to = str("to") ? [str("to")!] : [];
  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { folder, q: q || undefined, filter: unreadOnly ? "unread" : undefined, ...p };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    return `/comms?${u}`;
  };
  const mobilePane = compose ? "detail" : selected ? "detail" : "list";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Executive Comms</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">Internal correspondence</h1>
        </div>
        <ButtonLink href={href({ compose: "1", thread: undefined })}><PenSquare className="size-4" /> New message</ButtonLink>
      </div>

      <div className="surface grid min-h-[70vh] overflow-hidden p-0 md:grid-cols-[200px_320px_1fr]">
        {/* Mailbox */}
        <nav aria-label="Mailboxes" className={cn("border-b border-line p-3 md:border-b-0 md:border-r", mobilePane !== "list" && "hidden md:block")}>
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {FOLDERS.map((f) => (
              <li key={f.key}>
                <Link href={href({ folder: f.key, thread: undefined })} aria-current={folder === f.key ? "page" : undefined} className={cn("flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm", folder === f.key ? "bg-gold-400/[0.08] text-gold-200" : "text-ivory-muted hover:bg-white/[0.03] hover:text-ivory")}>
                  <f.icon className="size-4" aria-hidden /> {f.label}
                  {f.key === "INBOX" && counts.INBOX > 0 && <span className="ml-auto rounded-full bg-gold-400 px-1.5 font-mono text-[10px] text-ink-950">{counts.INBOX}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Thread list */}
        <section aria-label="Threads" className={cn("flex min-w-0 flex-col border-line md:border-r", mobilePane !== "list" && "hidden md:flex")}>
          <form className="flex items-center gap-2 border-b border-line p-3" action="/comms">
            <input type="hidden" name="folder" value={folder} />
            <Search className="size-4 text-ivory-faint" aria-hidden />
            <label htmlFor="comms-q" className="sr-only">Search Executive Comms</label>
            <input id="comms-q" name="q" defaultValue={q} placeholder="Search comms…" className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-ivory-faint" />
            <Link href={href({ filter: unreadOnly ? undefined : "unread" })} className={cn("rounded-full border px-2 py-0.5 text-[11px]", unreadOnly ? "border-line-gold text-gold-300" : "border-line text-ivory-faint")}>Unread</Link>
          </form>
          <ul className="flex-1 divide-y divide-line overflow-y-auto">
            {threadList.length === 0 && <li className="p-8 text-center text-sm text-ivory-faint">{folder === "INBOX" ? "No Executive Comms yet." : `Nothing in ${folder.toLowerCase()}.`}</li>}
            {threadList.map(({ msgs, last, first }) => {
              const execSender = [...msgs].reverse().find((m) => m.sender_type === "EXECUTIVE");
              const e = execSender ? execMap.get(execSender.sender_id) : execMap.get(first.recipient_executive_ids[0] ?? "");
              const unread = msgs.some((m) => !m.read_at);
              return (
                <li key={first.thread_id}>
                  <Link href={href({ thread: first.thread_id, compose: undefined })} className={cn("flex gap-3 px-3 py-3 transition hover:bg-white/[0.02]", threadId === first.thread_id && "bg-white/[0.04]")}>
                    {e ? <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={32} ring={false} /> : <Mail className="size-8 rounded-full bg-ink-800 p-2 text-ivory-faint" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn("truncate text-sm", unread ? "font-semibold" : "text-ivory/90")}>{first.subject}</p>
                        {msgs.some((m) => m.starred) && <Star className="size-3 shrink-0 fill-gold-400 text-gold-400" aria-label="Starred" />}
                      </div>
                      <p className="truncate text-xs text-ivory-muted">{truncate(last.body.replace(/[#*_>|]/g, ""), 90)}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-ivory-faint">{msgs.length > 1 ? `${msgs.length} messages · ` : ""}{formatRelative(last.created_at)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Detail */}
        <section aria-label="Communication" className={cn("min-w-0 p-5 sm:p-6", mobilePane !== "detail" && "hidden md:block")}>
          <Link href={href({ thread: undefined, compose: undefined })} className="mb-4 inline-flex items-center gap-1 text-sm text-ivory-muted md:hidden"><ArrowLeft className="size-4" /> Back</Link>
          {compose ? (
            <>
              <h2 className="mb-5 font-heading text-2xl">New message</h2>
              <ExecutiveCommsComposer execs={composerExecs} members={members} origins={origins} defaults={{ to }} />
            </>
          ) : selected ? (
            <ThreadView msgs={selected} execMap={execMap} composerExecs={composerExecs} members={members} userName={ctx.user.first_name} />
          ) : (
            <EmptyState icon={<Mail className="size-5" />} title="Select a communication" body="Or start a new message to one, several or all seven executives." action={<ButtonLink href={href({ compose: "1" })} size="sm">New message</ButtonLink>} />
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadView({ msgs, execMap, composerExecs, members, userName }: { msgs: Communication[]; execMap: Map<string, import("@/types/domain").AIExecutive>; composerExecs: { id: string; short_title: string; title: string; avatar_url: string | null; accent: string }[]; members: { id: string; name: string }[]; userName: string }) {
  const first = msgs[0];
  const anyUnread = msgs.some((m) => !m.read_at);
  const isDraft = msgs.every((m) => m.is_draft);
  const replyTo = [...new Set(msgs.flatMap((m) => (m.sender_type === "EXECUTIVE" ? [m.sender_id] : m.recipient_executive_ids)))];
  return (
    <article>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <h2 className="font-heading text-2xl">{first.subject}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {replyTo.map((id) => execMap.get(id)).filter(Boolean).map((e) => <Badge key={e!.id} tone="neutral">{e!.short_title}</Badge>)}
            {first.origin_type && <Badge tone="info">From {first.origin_type.toLowerCase()}</Badge>}
          </div>
        </div>
        <div className="flex gap-1">
          {(["star", "archive"] as const).map((op) => (
            <form key={op} action={updateCommunicationAction}>
              <input type="hidden" name="id" value={first.id} />
              <input type="hidden" name="op" value={op} />
              <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ivory-muted hover:text-ivory">{op === "star" ? (first.starred ? "Unstar" : "Star") : first.archived ? "Unarchive" : "Archive"}</button>
            </form>
          ))}
          {anyUnread && (
            <form action={updateCommunicationAction}>
              <input type="hidden" name="id" value={first.id} />
              <input type="hidden" name="op" value="read" />
              <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ivory-muted hover:text-ivory">Mark read</button>
            </form>
          )}
          {isDraft && (
            <form action={deleteDraftAction}>
              <input type="hidden" name="id" value={first.id} />
              <button className="rounded-lg border border-risk/30 px-2.5 py-1.5 text-xs text-risk">Delete draft</button>
            </form>
          )}
        </div>
      </header>
      <ol className="space-y-6 py-6">
        {msgs.map((m) => {
          const e = m.sender_type === "EXECUTIVE" ? execMap.get(m.sender_id) : undefined;
          return (
            <li key={m.id} className="flex gap-3">
              {e ? <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={36} ring={false} /> : <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line-gold bg-gold-400/10 text-xs text-gold-200">{userName[0]}</span>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold" style={e ? { color: e.accent } : undefined}>{e?.title ?? "You"}</span>
                  {m.simulated && <SimulatedBadge />}
                  {m.is_draft && <Badge tone="warn">Draft</Badge>}
                  <span className="font-mono text-[10px] text-ivory-faint">{formatRelative(m.created_at)}</span>
                </div>
                <div className="mt-1.5"><Markdown>{m.body}</Markdown></div>
              </div>
            </li>
          );
        })}
      </ol>
      {!isDraft && (
        <details className="rounded-2xl border border-line p-4">
          <summary className="cursor-pointer text-sm text-gold-300">Reply to thread</summary>
          <div className="mt-4">
            <ExecutiveCommsComposer execs={composerExecs} members={members} origins={[]} defaults={{ to: replyTo, subject: first.subject.startsWith("Re:") ? first.subject : `Re: ${first.subject}`, thread_id: first.thread_id }} />
          </div>
        </details>
      )}
    </article>
  );
}
