import { describe, expect, it } from "vitest";
import { SESSION_LIMITS, SESSION_MODES } from "@/config/sessions/modes";
import { parseRecommendedOption, parseVote, planStages, tallyVotes, voteLeader } from "@/server/ai/orchestration/plan";
import { resolvedExec } from "./fixtures";

const all = ["CEO", "CFO", "CCO", "CHRO", "CTO", "CLO", "CIO"].map((r) => resolvedExec(r));
const ceo = all[0];

describe("C-Suite orchestration plan", () => {
  it("runs independent positions in parallel and synthesis by the chair", () => {
    const plan = planStages(SESSION_MODES.CEO_SYNTHESIS, all.slice(0, 3), ceo);
    expect(plan.map((s) => s.def.key)).toEqual(["INDEPENDENT", "SYNTHESIS"]);
    expect(plan[0].parallel).toBe(true);
    expect(plan[0].turns).toHaveLength(3);
    expect(plan[1].turns.map((t) => t.exec.role_code)).toEqual(["CEO"]);
  });
  it("assigns specialty reviews to the right executive", () => {
    const plan = planStages(SESSION_MODES.FINANCIAL_REVIEW, all, ceo);
    expect(plan[1].turns.map((t) => t.exec.role_code)).toEqual(["CFO"]);
    expect(planStages(SESSION_MODES.IMPACT_REVIEW, all, ceo)[1].turns[0].exec.role_code).toBe("CIO");
  });
  it("skips a review whose lead is not at the table", () => {
    const plan = planStages(SESSION_MODES.RISK_REVIEW, [all[0], all[1]], ceo);
    expect(plan.map((s) => s.def.key)).toEqual(["INDEPENDENT", "SYNTHESIS"]);
  });
  it("is always bounded", () => {
    const many = [...all, ...all, ...all];
    for (const mode of Object.values(SESSION_MODES)) {
      const plan = planStages(mode, many, ceo);
      expect(plan.length).toBeLessThanOrEqual(SESSION_LIMITS.maxRounds);
      const turns = plan.reduce((n, s) => n + s.turns.length, 0);
      expect(turns).toBeLessThanOrEqual(SESSION_LIMITS.maxParticipants * SESSION_LIMITS.maxRounds);
    }
  });
  it("can call on a single executive", () => {
    const plan = planStages(SESSION_MODES.DEEP_DIVE, all, ceo, "exec-CTO");
    expect(plan).toHaveLength(1);
    expect(plan[0].turns[0].exec.role_code).toBe("CTO");
  });
  it("parses executive votes", () => {
    expect(parseVote("...\nVOTE: b | CONFIDENCE: 72")).toEqual({ option: "B", confidence: 72 });
    expect(parseVote("no vote")).toBeNull();
  });
});

describe("Executive Vote results", () => {
  const ballot = [{ id: "A", label: "Raise" }, { id: "B", label: "Bootstrap" }, { id: "C", label: "Loan" }];

  it("tallies every option in ballot order, ignoring unknown ids", () => {
    const t = tallyVotes(ballot, [{ option_id: "B", confidence: 0.6 }, { option_id: "B", confidence: 0.8 }, { option_id: "A", confidence: 0.9 }, { option_id: "Z", confidence: 1 }]);
    expect(t.map((x) => [x.id, x.votes])).toEqual([["A", 1], ["B", 2], ["C", 0]]);
    expect(t[1].avgConfidence).toBeCloseTo(0.7);
    expect(t[2].avgConfidence).toBeNull();
  });

  it("picks the vote leader, breaking ties on confidence and refusing true ties", () => {
    expect(voteLeader(tallyVotes(ballot, [{ option_id: "A", confidence: 0.5 }, { option_id: "B", confidence: 0.9 }]))).toBe("B");
    expect(voteLeader(tallyVotes(ballot, [{ option_id: "A", confidence: 0.5 }, { option_id: "B", confidence: 0.5 }]))).toBeNull();
    expect(voteLeader(tallyVotes(ballot, []))).toBeNull();
  });

  it("reads the chair's recommended option only when it was on the ballot", () => {
    expect(parseRecommendedOption("…\nRECOMMENDED OPTION: **c**", ["A", "B", "C"])).toBe("C");
    expect(parseRecommendedOption("RECOMMENDED OPTION: D", ["A", "B", "C"])).toBeNull();
    expect(parseRecommendedOption("No line here", ["A"])).toBeNull();
  });
});
