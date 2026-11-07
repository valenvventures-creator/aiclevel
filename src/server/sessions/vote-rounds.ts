import { DEFAULT_VOTE_OPTIONS } from "@/config/sessions/modes";
import { tallyVotes, tiedLeaders, voteLeader, type VoteTally } from "@/server/ai/orchestration/plan";
import type { CSuiteSessionMessage, CSuiteVote, Decision } from "@/types/domain";

/**
 * Groups a session's votes into vote rounds. A round starts at a leadership
 * question that opened a vote (metadata.vote_options, not a single-executive
 * retry) and holds every vote cast until the next such question — so a
 * retried vote joins the round it belongs to. Pure; shared by the session
 * page, Minutes and Decision Memos.
 */
export interface VoteRound {
  questionId: string | null;
  question: string;
  askedAt: string;
  ballot: { id: string; label: string }[];
  defaulted: boolean;
  votes: CSuiteVote[];
  tally: VoteTally[];
  leader: string | null;
  tied: string[];
  decision: Decision | null;
}

type Msg = Pick<CSuiteSessionMessage, "id" | "stage" | "content" | "created_at" | "metadata">;

export function groupVoteRounds(messages: Msg[], votes: CSuiteVote[], decisions: Decision[]): VoteRound[] {
  const openers = messages
    .filter((m) => m.stage === "QUESTION" && Array.isArray(m.metadata?.vote_options) && !m.metadata?.single_executive)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byTime = (a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at);

  // Votes from before ballots were recorded: one legacy round labelled from its decision.
  if (!openers.length) {
    if (!votes.length) return [];
    const decision = decisions.find((d) => d.options_json.length > 0) ?? null;
    const ids = [...new Set(votes.map((v) => v.option_id))].sort();
    const ballot = decision?.options_json.length ? decision.options_json : ids.map((id) => ({ id, label: DEFAULT_VOTE_OPTIONS.find((o) => o.id === id)?.label ?? `Option ${id}` }));
    return [build(null, decision?.question ?? "", votes[0].created_at, ballot, false, [...votes].sort(byTime), decision)];
  }

  return openers.map((q, i) => {
    const next = openers[i + 1]?.created_at;
    const inRound = <T extends { created_at: string }>(x: T) => x.created_at >= q.created_at && (!next || x.created_at < next);
    const ballot = q.metadata.vote_options as { id: string; label: string }[];
    const decision = decisions.filter(inRound).sort(byTime)[0] ?? null;
    return build(q.id, q.content, q.created_at, ballot, Boolean(q.metadata.defaulted_options), latestPerExecutive(votes.filter(inRound).sort(byTime)), decision);
  });
}

/** One vote per executive per round: a retried vote replaces the earlier one. */
function latestPerExecutive(votes: CSuiteVote[]): CSuiteVote[] {
  const latest = new Map<string, CSuiteVote>();
  for (const v of votes) latest.set(v.executive_id, v);
  return [...latest.values()];
}

function build(questionId: string | null, question: string, askedAt: string, ballot: { id: string; label: string }[], defaulted: boolean, votes: CSuiteVote[], decision: Decision | null): VoteRound {
  const tally = tallyVotes(ballot, votes);
  return { questionId, question, askedAt, ballot, defaulted, votes, tally, leader: voteLeader(tally), tied: tiedLeaders(tally), decision };
}

/** The round a decision came from (the latest round that opened at or before it). */
export function roundForDecision(rounds: VoteRound[], decision: Decision): VoteRound | null {
  return rounds.find((r) => r.decision?.id === decision.id) ?? null;
}

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const score = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)} / 10`);

/** "How the C-Suite voted" as Markdown, for Minutes and Decision Memos. */
export function voteRoundMarkdown(round: VoteRound, titleOf: (executiveId: string) => string, heading = "## How the C-Suite voted"): string {
  const label = new Map(round.ballot.map((o) => [o.id, o.label]));
  const recommended = round.decision?.recommended_option ?? null;
  const blocks = [
    heading,
    round.question ? `**Question:** ${round.question}` : "",
    round.defaulted ? "_No options were entered, so the executives voted on A: Proceed and B: Do not proceed._" : "",
    [
      "| Option | Votes | Avg score | Avg confidence |",
      "|---|---|---|---|",
      ...round.tally.map((t) => `| **${t.id}** — ${cell(t.label)}${recommended === t.id ? " _(CEO recommends)_" : ""}${round.decision?.chosen_option === t.id ? " _(chosen)_" : ""} | ${t.votes} of ${round.votes.length} | ${score(t.avgScore)} | ${pct(t.avgConfidence)} |`),
    ].join("\n"),
    round.tied.length ? `_Tied on votes between ${round.tied.join(" and ")}._` : "",
    round.votes.length
      ? ["| Executive | Vote | Confidence | Reason |", "|---|---|---|---|", ...round.votes.map((v) => `| ${cell(titleOf(v.executive_id))} | ${v.option_id} — ${cell(label.get(v.option_id) ?? "")} | ${pct(v.confidence)} | ${cell(v.reason || "")} |`)].join("\n")
      : "",
  ];
  return blocks.filter(Boolean).join("\n\n");
}

const cell = (s: string) => s.replace(/\|/g, "/").replace(/\s*\n\s*/g, " ").trim();
