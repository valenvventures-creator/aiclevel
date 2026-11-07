import { ChevronDown } from "lucide-react";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
import type { VoteRound } from "@/server/sessions/vote-rounds";

export interface VoterInfo { shortTitle: string; title: string; accent: string }

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Executive Vote results: the latest round in full (each option's wording,
 * votes, average score and confidence, the CEO's pick, ties, and each
 * executive's vote with their reason), earlier rounds collapsed below.
 */
export function VoteResults({ rounds, voters }: { rounds: VoteRound[]; voters: Record<string, VoterInfo> }) {
  const shown = rounds.filter((r) => r.votes.length > 0);
  if (!shown.length) return null;
  const latest = shown[shown.length - 1];
  const earlier = shown.slice(0, -1).reverse();
  return (
    <Card>
      <SectionTitle>Executive vote</SectionTitle>
      <RoundDetail round={latest} voters={voters} />
      {earlier.length > 0 && (
        <details className="group mt-5 border-t border-line pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-ivory-muted hover:text-ivory">
            Previous votes ({earlier.length})
            <ChevronDown className="size-3.5 transition group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="mt-3 space-y-4">
            {earlier.map((r) => (
              <li key={r.questionId ?? r.askedAt} className="rounded-xl border border-line p-3">
                <RoundDetail round={r} voters={voters} compact />
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function RoundDetail({ round, voters, compact = false }: { round: VoteRound; voters: Record<string, VoterInfo>; compact?: boolean }) {
  const total = round.votes.length;
  const label = new Map(round.ballot.map((o) => [o.id, o.label]));
  const recommended = round.decision?.recommended_option ?? null;
  const chosen = round.decision?.chosen_option ?? null;
  return (
    <div>
      {round.question && <p className={compact ? "mb-2 text-xs text-ivory" : "-mt-1 mb-3 text-xs text-ivory-muted"}>“{round.question}”</p>}
      <ul className="space-y-3" aria-label="Vote results by option">
        {round.tally.map((t) => {
          const share = total ? Math.round((t.votes / total) * 100) : 0;
          return (
            <li key={t.id}>
              <div className="flex items-start gap-2 text-sm">
                <span className="mt-px w-4 shrink-0 font-mono text-xs text-gold-300">{t.id}</span>
                <span className="min-w-0 flex-1">{t.label}</span>
                {chosen === t.id ? <Badge tone="ok">Chosen</Badge> : recommended === t.id && <Badge tone="gold">CEO recommends</Badge>}
              </div>
              <div className="mt-1.5 ml-6 h-1.5 overflow-hidden rounded-full bg-ink-800" role="img" aria-label={`${t.votes} of ${total} votes`}>
                <div className="h-full rounded-full bg-gold-400" style={{ width: `${share}%` }} />
              </div>
              <p className="mt-1 ml-6 font-mono text-[10px] text-ivory-faint">
                {t.votes} of {total} {total === 1 ? "vote" : "votes"}
                {t.avgScore !== null && ` · avg score ${t.avgScore.toFixed(1)}/10`}
                {t.avgConfidence !== null && ` · confidence ${pct(t.avgConfidence)}`}
              </p>
            </li>
          );
        })}
      </ul>
      {round.tied.length > 0 && (
        <p className="mt-3 rounded-lg border border-warn/40 px-3 py-2 text-xs text-warn">
          Tied on votes between {round.tied.map((id) => `${id} (${label.get(id) ?? `Option ${id}`})`).join(" and ")}.
          {recommended ? ` The CEO recommends ${recommended}.` : " The CEO's synthesis weighs the tie."}
        </p>
      )}
      {round.defaulted && <p className="mt-3 text-[11px] text-ivory-faint">No options were entered, so the executives voted on A: Proceed and B: Do not proceed.</p>}
      <p className="mt-4 mb-2 font-mono text-[10px] tracking-[0.18em] text-ivory-faint">HOW EACH EXECUTIVE VOTED</p>
      <ul className="space-y-1">
        {round.votes.map((v) => {
          const who = voters[v.executive_id];
          return (
            <li key={v.id}>
              <details className="group rounded-lg px-1 py-0.5 open:bg-ink-850">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs" title="Show reason">
                  <span className="w-10 shrink-0 font-display tracking-[0.12em]" style={{ color: who?.accent }}>{who?.shortTitle ?? "EXEC"}</span>
                  <span className="min-w-0 flex-1 truncate text-ivory-muted"><span className="font-mono text-gold-300">{v.option_id}</span> · {label.get(v.option_id) ?? `Option ${v.option_id}`}</span>
                  <span className="shrink-0 font-mono text-ivory-faint">{pct(v.confidence)}</span>
                  <ChevronDown className="size-3 shrink-0 text-ivory-faint transition group-open:rotate-180" aria-hidden />
                </summary>
                <div className="space-y-1 px-1 pt-1.5 pb-1 text-xs text-ivory-muted">
                  <p><span className="text-ivory">{who?.title ?? "Executive"}:</span> {v.reason || "No reason was given."}</p>
                  {v.scores_json && Object.keys(v.scores_json).length > 0 && (
                    <p className="font-mono text-[10px] text-ivory-faint">Scores: {round.ballot.filter((o) => v.scores_json?.[o.id] !== undefined).map((o) => `${o.id} ${v.scores_json![o.id]}`).join(" · ")}</p>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
