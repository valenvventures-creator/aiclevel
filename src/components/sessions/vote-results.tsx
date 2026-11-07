import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
import type { VoteTally } from "@/server/ai/orchestration/plan";

export interface VoterRow { id: string; shortTitle: string; accent: string; optionId: string; confidence: number }

/**
 * Executive Vote results for the latest vote round: every option with its
 * wording, how many executives chose it, and who voted for what.
 */
export function VoteResults({ question, tally, voters, recommended, defaulted }: { question: string | null; tally: VoteTally[]; voters: VoterRow[]; recommended: string | null; defaulted: boolean }) {
  const total = voters.length;
  const label = new Map(tally.map((t) => [t.id, t.label]));
  return (
    <Card>
      <SectionTitle>Executive vote</SectionTitle>
      {question && <p className="-mt-1 mb-3 text-xs text-ivory-muted">“{question}”</p>}
      <ul className="space-y-3" aria-label="Vote results by option">
        {tally.map((t) => {
          const share = total ? Math.round((t.votes / total) * 100) : 0;
          return (
            <li key={t.id}>
              <div className="flex items-start gap-2 text-sm">
                <span className="mt-px w-4 shrink-0 font-mono text-xs text-gold-300">{t.id}</span>
                <span className="min-w-0 flex-1">{t.label}</span>
                {recommended === t.id && <Badge tone="gold">CEO recommends</Badge>}
              </div>
              <div className="mt-1.5 ml-6 h-1.5 overflow-hidden rounded-full bg-ink-800" role="img" aria-label={`${t.votes} of ${total} votes`}>
                <div className="h-full rounded-full bg-gold-400" style={{ width: `${share}%` }} />
              </div>
              <p className="mt-1 ml-6 font-mono text-[10px] text-ivory-faint">
                {t.votes} of {total} {total === 1 ? "vote" : "votes"}
                {t.avgConfidence !== null && ` · avg confidence ${Math.round(t.avgConfidence * 100)}%`}
              </p>
            </li>
          );
        })}
      </ul>
      {defaulted && <p className="mt-3 text-[11px] text-ivory-faint">No options were entered, so the executives voted on A: Proceed and B: Do not proceed.</p>}
      {voters.length > 0 && (
        <>
          <p className="mt-4 mb-2 font-mono text-[10px] tracking-[0.18em] text-ivory-faint">HOW EACH EXECUTIVE VOTED</p>
          <ul className="space-y-1.5">
            {voters.map((v) => (
              <li key={v.id} className="flex items-center gap-2 text-xs">
                <span className="w-10 shrink-0 font-display tracking-[0.12em]" style={{ color: v.accent }}>{v.shortTitle}</span>
                <span className="min-w-0 flex-1 truncate text-ivory-muted"><span className="font-mono text-gold-300">{v.optionId}</span> · {label.get(v.optionId) ?? `Option ${v.optionId}`}</span>
                <span className="shrink-0 font-mono text-ivory-faint">{Math.round(v.confidence * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
