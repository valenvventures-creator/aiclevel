import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileText, Gavel, ScrollText } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { SessionRunner } from "@/components/sessions/session-runner";
import { VoteResults } from "@/components/sessions/vote-results";
import { FeedbackButtons } from "@/components/executives/feedback-buttons";
import { Markdown } from "@/components/ui/markdown";
import { Badge, Card, SectionTitle, SimulatedBadge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { DEFAULT_VOTE_OPTIONS, SESSION_MODES } from "@/config/sessions/modes";
import { parseVoteDetails, stripRecommendedLine } from "@/server/ai/orchestration/plan";
import { groupVoteRounds } from "@/server/sessions/vote-rounds";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { requireContext } from "@/server/organizations/service";
import { can } from "@/server/auth/permissions";
import { createDecisionMemoAction, createMinutesAction } from "@/server/sessions/actions";

export const metadata: Metadata = { title: "C-Suite Session" };

export default async function SessionPage({ params, searchParams }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireContext();
  const orgId = ctx.organization.id;
  const session = await db().sessions.get(orgId, id);
  if (!session) notFound();
  const [execs, messages, decisions, votes] = await Promise.all([
    AIExecutiveRegistry.getAllExecutives(orgId),
    db().sessionMessages.list(orgId, { where: { session_id: id }, orderBy: "sequence_number" }),
    db().decisions.list(orgId, { where: { session_id: id }, orderBy: "created_at", desc: true }),
    db().votes.list(orgId, { where: { session_id: id } }),
  ]);
  const map = new Map(execs.map((e) => [e.id, e]));
  const participants = session.participant_executive_ids.map((pid) => map.get(pid)).filter((e): e is NonNullable<typeof e> => Boolean(e));
  const mode = SESSION_MODES[session.mode];
  const canRun = can(ctx.role, "sessions.create");
  // A round in progress has saved state; "RUNNING" without it is a round an older version left behind.
  const inProgress = Boolean(session.run_state);
  const status = session.status === "RUNNING" && !inProgress ? "ACTIVE" : session.status === "RUNNING" ? "IN SESSION" : session.status;

  // Vote rounds (ballot, votes, decision) — shared with Minutes and Decision Memos.
  const rounds = groupVoteRounds(messages, votes, decisions);
  const ballotAt = (at: string) => [...rounds].reverse().find((r) => r.askedAt <= at)?.ballot ?? DEFAULT_VOTE_OPTIONS;
  const canApprove = can(ctx.role, "decisions.approve");
  const canRate = can(ctx.role, "executives.use");
  // This person's earlier ratings of answers in this session.
  const ratings = new Map(canRate ? (await db().feedback.list(orgId, { where: { source_type: "SESSION", created_by: ctx.user.id } })).map((f) => [f.source_id, f.rating]) : []);
  // What the last round asked, so a failed executive can be retried on the same question and ballot.
  const lastAsk = [...messages].reverse().find((m) => m.stage === "QUESTION" && !m.metadata?.retry);
  const optionName = (d: (typeof decisions)[number], id: string | null | undefined) => (id ? `Option ${id}${d.options_json.find((o) => o.id === id) ? ` — ${d.options_json.find((o) => o.id === id)!.label}` : ""}` : "");

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <header className="mb-6">
          <Link href="/sessions" className="text-xs text-ivory-muted hover:text-ivory">← C-Suite Sessions</Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="gold">{mode.label}</Badge>
            <Badge tone={inProgress ? "warn" : session.status === "FAILED" ? "risk" : "neutral"}>{status}</Badge>
          </div>
          <h1 className="mt-3 font-heading text-3xl font-semibold sm:text-4xl">{session.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-ivory-muted">{session.objective}</p>
        </header>

        {/* Participant strip (mobile-first) */}
        <ul className="scrollbar-thin mb-8 flex gap-4 overflow-x-auto pb-2" aria-label="Participants">
          {participants.map((e) => (
            <li key={e.id} className="flex shrink-0 flex-col items-center gap-1.5">
              <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={52} />
              <span className="font-display text-[10px] tracking-[0.18em]" style={{ color: e.accent }}>{e.short_title}{session.chair_executive_id === e.id ? " · CHAIR" : ""}</span>
            </li>
          ))}
        </ul>

        {/* Transcript */}
        <section aria-label="Session transcript" className="space-y-4">
          {messages.filter((m) => m.stage !== "CONVENED").map((m) => {
            if (m.speaker_type === "SYSTEM") {
              if (m.metadata?.failed) return <p key={m.id} className="rounded-xl border border-risk/30 px-4 py-2 text-sm text-risk">{m.content}</p>;
              return (
                <div key={m.id} className="flex items-center gap-3 pt-4">
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[10px] tracking-[0.22em] text-ivory-faint">{m.content.toUpperCase()}</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              );
            }
            if (m.speaker_type === "USER") {
              return (
                <div key={m.id} className="rounded-2xl border border-line-gold/60 bg-gold-400/[0.05] p-4">
                  <p className="font-mono text-[10px] tracking-[0.2em] text-gold-300">LEADERSHIP{m.metadata?.retry ? " · RETRY" : ""} · {formatRelative(m.created_at).toUpperCase()}</p>
                  <p className="mt-1.5 text-sm">{m.content}</p>
                </div>
              );
            }
            const e = map.get(m.speaker_id ?? "");
            const synth = m.stage === "SYNTHESIS";
            if (m.stage === "VOTE") {
              const ballot = ballotAt(m.created_at);
              const vote = parseVoteDetails(m.content, ballot.map((o) => o.id));
              if (vote) {
                return (
                  <article key={m.id} className="flex gap-3 rounded-2xl border border-line p-4">
                    {e && <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={36} ring={false} />}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: e?.accent }}>{e?.title}</span>
                        <span className="font-mono text-[10px] text-ivory-faint">VOTE</span>
                        {m.simulated && <SimulatedBadge />}
                      </div>
                      <p className="text-sm">
                        Voted <span className="font-mono text-gold-300">{vote.option}</span> — {ballot.find((o) => o.id === vote.option)?.label ?? `Option ${vote.option}`}
                        <span className="text-ivory-faint"> · {vote.confidence}% confidence</span>
                      </p>
                      {vote.reason && <p className="mt-1 text-sm text-ivory-muted">{vote.reason}</p>}
                      <details className="group mt-2">
                        <summary className="cursor-pointer list-none text-xs text-gold-300 hover:text-gold-200">Show full scoring</summary>
                        <div className="mt-2"><Markdown>{m.content}</Markdown></div>
                      </details>
                      {canRate && e && <div className="mt-2"><FeedbackButtons executiveId={e.id} executiveTitle={e.title} sourceType="SESSION" sourceId={m.id} initial={ratings.get(m.id) ?? null} /></div>}
                    </div>
                  </article>
                );
              }
            }
            return (
              <article key={m.id} className={synth ? "plate p-5 shadow-[var(--shadow-gold)]" : "flex gap-3 rounded-2xl border border-line p-4"}>
                {!synth && e && <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={36} ring={false} />}
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {synth && e && <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={28} ring={false} />}
                    <span className="text-sm font-semibold" style={{ color: e?.accent }}>{synth ? `${e?.title ?? "Chair"} — Synthesis` : e?.title}</span>
                    <span className="font-mono text-[10px] text-ivory-faint">{m.stage.replace(/_/g, " ")}</span>
                    {Array.isArray(m.metadata?.sources) && m.metadata.sources.length > 0 && <Badge tone="info">Web research</Badge>}
                    {m.simulated && <SimulatedBadge />}
                  </div>
                  <Markdown>{synth ? stripRecommendedLine(m.content) : m.content}</Markdown>
                  {canRate && e && <div className="mt-2"><FeedbackButtons executiveId={e.id} executiveTitle={e.title} sourceType="SESSION" sourceId={m.id} initial={ratings.get(m.id) ?? null} /></div>}
                </div>
              </article>
            );
          })}
          {messages.filter((m) => m.speaker_type !== "SYSTEM").length === 0 && <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-ivory-muted">The table is set. Pose your question below to begin.</p>}
        </section>

        <div className="mt-8">
          <SessionRunner
            sessionId={session.id}
            participants={participants.map((e) => ({ id: e.id, title: e.title, short_title: e.short_title, avatar_url: e.avatar_url, accent: e.accent, role_code: e.role_code }))}
            modes={Object.values(SESSION_MODES).map((m) => ({ mode: m.mode, label: m.label, description: m.description }))}
            defaultMode={session.mode}
            objective={session.objective}
            autostart={sp.autostart === "1" && messages.filter((m) => m.speaker_type === "USER").length === 0}
            resume={inProgress}
            canRun={canRun}
            lastAsk={lastAsk ? { question: lastAsk.content, ballot: (lastAsk.metadata?.vote_options as { id: string; label: string }[] | undefined) ?? null } : null}
          />
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <SectionTitle>Decision record</SectionTitle>
          {decisions.length === 0 ? (
            <p className="text-sm text-ivory-faint">A structured decision is recorded after a CEO synthesis.</p>
          ) : (
            decisions.map((d, i) => (
              <div key={d.id} className={i > 0 ? "mt-4 space-y-2 border-t border-line pt-4" : "space-y-2"}>
                <div className="flex items-center justify-between"><Badge tone={d.status === "APPROVED" ? "ok" : "gold"}>{d.status}</Badge><span className="font-mono text-[10px] text-ivory-faint">CONF {Math.round(d.confidence * 100)}%</span></div>
                <p className="text-xs text-ivory-muted">“{d.question}”</p>
                {d.chosen_option ? (
                  <p className="rounded-lg border border-ok/40 bg-ok/[0.06] px-3 py-2 text-sm">
                    <span className="block font-mono text-[10px] tracking-[0.18em] text-ok">CHOSEN</span>
                    {optionName(d, d.chosen_option)}
                    {d.recommended_option && d.recommended_option !== d.chosen_option && <span className="mt-0.5 block text-xs text-ivory-muted">The CEO recommended {optionName(d, d.recommended_option)}.</span>}
                  </p>
                ) : d.recommended_option && (
                  <p className="rounded-lg border border-line-gold/60 bg-gold-400/[0.05] px-3 py-2 text-sm">
                    <span className="block font-mono text-[10px] tracking-[0.18em] text-gold-300">CEO RECOMMENDS</span>
                    {optionName(d, d.recommended_option)}
                  </p>
                )}
                <p className="text-sm">{d.recommendation.slice(0, 280)}</p>
                {d.risks_json.length > 0 && (
                  <ul className="space-y-1 text-xs text-ivory-muted">{d.risks_json.slice(0, 4).map((r, i) => <li key={i}>• {r.risk} <span className="text-warn">({r.severity})</span></li>)}</ul>
                )}
                {canApprove && d.status !== "APPROVED" && (
                  <Link href={`/decisions#${d.id}`} className="flex h-8 items-center justify-center rounded-full bg-gold-400/10 text-xs font-medium text-gold-200 hover:bg-gold-400/20">Review &amp; approve →</Link>
                )}
                <form action={createDecisionMemoAction.bind(null, d.id)}><Button size="sm" variant="outline" className="w-full"><Gavel className="size-3.5" /> Create decision memo</Button></form>
              </div>
            ))
          )}
        </Card>
        <VoteResults rounds={rounds} voters={Object.fromEntries(execs.map((e) => [e.id, { shortTitle: e.short_title, title: e.title, accent: e.accent }]))} />
        <Card>
          <SectionTitle>Record</SectionTitle>
          <div className="space-y-2">
            <form action={createMinutesAction.bind(null, session.id)}><Button size="sm" variant="outline" className="w-full"><ScrollText className="size-3.5" /> Create minutes</Button></form>
            <Link href={`/comms?compose=1`} className="flex h-8 items-center justify-center gap-2 rounded-full border border-line-strong text-xs hover:border-line-gold"><FileText className="size-3.5" /> Share via Executive Comms</Link>
          </div>
          <p className="mt-3 text-[11px] text-ivory-faint">Bounded orchestration: ≤7 executives, ≤{mode.maxRounds} stages, one retry per executive.</p>
        </Card>
      </aside>
    </div>
  );
}
