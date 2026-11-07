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
    return one ? [{ def: { key: "INDEPENDENT", label: `${one.title} responds`, promptKey: "c_suite_session" }, turns: [{ exec: one }], parallel: false }] : [];
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
