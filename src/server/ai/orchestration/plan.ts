import type { SessionModeDef, SessionStageDef } from "@/config/sessions/modes";
import { SESSION_LIMITS } from "@/config/sessions/modes";
import type { ResolvedExecutive } from "@/types/domain";

export interface PlannedTurn { exec: ResolvedExecutive }
export interface PlannedStage { def: SessionStageDef; turns: PlannedTurn[]; parallel: boolean }

/**
 * Pure, bounded stage planner. Converts a mode definition into a finite list
 * of turns. Unit-tested — this is where runaway loops are made impossible.
 */
export function planStages(mode: SessionModeDef, participants: ResolvedExecutive[], chair: ResolvedExecutive, onlyExecutiveId?: string): PlannedStage[] {
  const capped = participants.slice(0, SESSION_LIMITS.maxParticipants);
  if (onlyExecutiveId) {
    const one = capped.find((e) => e.id === onlyExecutiveId);
    if (!one) return [];
    // Calling on one executive in a vote mode asks for their vote (e.g. retrying a vote that failed).
    const vote = mode.stages.find((s) => s.key === "VOTE");
    if (vote) return [{ def: { ...vote, label: `${one.title} votes` }, turns: [{ exec: one }], parallel: false }];
    return [{ def: { key: "INDEPENDENT", label: `${one.title} responds`, promptKey: "c_suite_session" }, turns: [{ exec: one }], parallel: false }];
  }
  const stages: PlannedStage[] = [];
  for (const def of mode.stages.slice(0, Math.min(mode.maxRounds, SESSION_LIMITS.maxRounds))) {
    let execs: ResolvedExecutive[];
    if (def.key === "SYNTHESIS") execs = [chair];
    else if (def.leads?.length) {
      execs = capped.filter((e) => def.leads!.includes(e.role_code));
      if (!execs.length) continue; // lead not in the room — skip that review
    } else execs = capped;
    stages.push({ def, turns: execs.map((exec) => ({ exec })), parallel: def.key === "INDEPENDENT" || def.key === "VOTE" });
  }
  return stages;
}

export function parseVote(text: string): { option: string; confidence: number } | null {
  const m = text.match(/VOTE:\s*([A-Za-z0-9_-]+)\s*\|\s*CONFIDENCE:\s*(\d{1,3})/i);
  return m ? { option: m[1].toUpperCase(), confidence: Math.min(100, Number(m[2])) } : null;
}

export interface VoteDetails { option: string; confidence: number; scores: Record<string, number>; reason: string }

const cleanCell = (c: string) => c.replace(/\*\*|__|`/g, "").trim();

/**
 * Reads an executive's vote: the final "VOTE: <id> | CONFIDENCE: <n>" line, the
 * per-option scores from their "Option | Score | Reason" table, and a short
 * reason (the table's reason for the chosen option, else the text before the vote line).
 */
export function parseVoteDetails(text: string, optionIds: string[]): VoteDetails | null {
  const v = parseVote(text);
  if (!v) return null;
  const scores: Record<string, number> = {};
  const reasons: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("|") || /^\s*\|[\s:-]+\|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map(cleanCell);
    if (cells.length < 2) continue;
    const id = cells[0].replace(/^option\s+/i, "").split(/[\s:—–-]/)[0]?.toUpperCase();
    const score = Number.parseFloat(cells[1]);
    if (!id || !optionIds.includes(id) || !Number.isFinite(score)) continue;
    scores[id] = Math.max(0, Math.min(10, score));
    if (cells[2]) reasons[id] = cells[2];
  }
  const before = text.split(/VOTE:/i)[0].split("\n").filter((l) => l.trim() && !l.trim().startsWith("|") && !l.trim().startsWith(">")).join(" ");
  const reason = (reasons[v.option] || cleanCell(before)).replace(/\s+/g, " ").trim().slice(0, 300);
  return { ...v, scores, reason };
}

/** Removes the machine-readable "RECOMMENDED OPTION: X" line from text shown to people. */
export function stripRecommendedLine(text: string): string {
  return text.replace(/\n*^\s*\**RECOMMENDED OPTION:.*$/gim, "").trimEnd();
}

/** Reads the chair's "RECOMMENDED OPTION: <id>" line, accepting only ids that were on the ballot. */
export function parseRecommendedOption(text: string, optionIds: string[]): string | null {
  const m = text.match(/RECOMMENDED OPTION:\s*\**\s*([A-Za-z0-9_-]+)/i);
  const id = m?.[1].toUpperCase();
  return id && optionIds.includes(id) ? id : null;
}

export interface VoteTally { id: string; label: string; votes: number; avgConfidence: number | null; avgScore: number | null }

/**
 * Counts votes per option (every option listed, ballot order kept); unknown ids are ignored.
 * avgScore is the mean 1–10 score every voter gave the option, whether or not they voted for it.
 */
export function tallyVotes(options: { id: string; label: string }[], votes: { option_id: string; confidence: number; scores_json?: Record<string, number> | null }[]): VoteTally[] {
  return options.map((o) => {
    const mine = votes.filter((v) => v.option_id === o.id);
    const scored = votes.map((v) => v.scores_json?.[o.id]).filter((n): n is number => typeof n === "number");
    return {
      id: o.id,
      label: o.label,
      votes: mine.length,
      avgConfidence: mine.length ? mine.reduce((n, v) => n + v.confidence, 0) / mine.length : null,
      avgScore: scored.length ? scored.reduce((n, x) => n + x, 0) / scored.length : null,
    };
  });
}

/** Options sharing the highest vote count, when more than one does. */
export function tiedLeaders(tally: VoteTally[]): string[] {
  const top = Math.max(0, ...tally.map((t) => t.votes));
  const leaders = tally.filter((t) => t.votes === top && top > 0);
  return leaders.length > 1 ? leaders.map((t) => t.id) : [];
}

/** The option with the most votes; ties go to higher average confidence. Null when nobody voted or the top is still tied. */
export function voteLeader(tally: VoteTally[]): string | null {
  const ranked = [...tally].filter((t) => t.votes > 0).sort((a, b) => b.votes - a.votes || (b.avgConfidence ?? 0) - (a.avgConfidence ?? 0));
  if (!ranked.length) return null;
  const [first, second] = ranked;
  if (second && second.votes === first.votes && second.avgConfidence === first.avgConfidence) return null;
  return first.id;
}
