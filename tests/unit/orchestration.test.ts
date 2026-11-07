import { describe, expect, it } from "vitest";
import { SESSION_LIMITS, SESSION_MODES } from "@/config/sessions/modes";
import { parseRecommendedOption, parseVote, parseVoteDetails, planStages, stripRecommendedLine, tallyVotes, tiedLeaders, voteLeader } from "@/server/ai/orchestration/plan";
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

describe("vote details and ties", () => {
  const ids = ["A", "B", "C"];
  const answer = [
    "| Option | Score | Reason |",
    "|---|---|---|",
    "| **A** | 8 | Strongest runway. |",
    "| Option B | 6 | Slower, but cheaper. |",
    "| C — loan | 3.5 | Covenants bite. |",
    "",
    "VOTE: A | CONFIDENCE: 72",
  ].join("\n");

  it("reads the vote, every option's score and the reason for the chosen option", () => {
    const v = parseVoteDetails(answer, ids);
    expect(v).toEqual({ option: "A", confidence: 72, scores: { A: 8, B: 6, C: 3.5 }, reason: "Strongest runway." });
  });

  it("falls back to the text before the vote line when there is no table", () => {
    expect(parseVoteDetails("I back the pilot because it is reversible.\nVOTE: B | CONFIDENCE: 55", ids)?.reason).toBe("I back the pilot because it is reversible.");
  });

  it("averages scores across all voters, and reports true vote ties", () => {
    const t = tallyVotes([{ id: "A", label: "x" }, { id: "B", label: "y" }], [
      { option_id: "A", confidence: 0.7, scores_json: { A: 8, B: 6 } },
      { option_id: "B", confidence: 0.6, scores_json: { A: 4, B: 9 } },
    ]);
    expect(t[0].avgScore).toBe(6);
    expect(t[1].avgScore).toBe(7.5);
    expect(tiedLeaders(t)).toEqual(["A", "B"]);
  });

  it("hides the machine-readable recommendation line from people", () => {
    expect(stripRecommendedLine("## Confidence\n60%\n\nRECOMMENDED OPTION: B")).toBe("## Confidence\n60%");
  });

  it("asks a single called-on executive for their vote in a vote mode", () => {
    const plan = planStages(SESSION_MODES.EXECUTIVE_VOTE, all.slice(0, 3), ceo, all[1].id);
    expect(plan).toHaveLength(1);
    expect(plan[0].def.key).toBe("VOTE");
    expect(plan[0].turns.map((t) => t.exec.id)).toEqual([all[1].id]);
  });

  it("discusses before voting in Discuss, then Vote", () => {
    expect(planStages(SESSION_MODES.DISCUSS_AND_VOTE, all.slice(0, 3), ceo).map((s) => s.def.key)).toEqual(["INDEPENDENT", "VOTE", "SYNTHESIS"]);
  });
});
