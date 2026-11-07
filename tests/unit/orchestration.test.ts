import { describe, expect, it } from "vitest";
import { SESSION_LIMITS, SESSION_MODES } from "@/config/sessions/modes";
import { parseVote, planStages } from "@/server/ai/orchestration/plan";
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
