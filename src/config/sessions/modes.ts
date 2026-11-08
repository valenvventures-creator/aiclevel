import type { ExecutiveRoleCode, SessionMode } from "@/types/domain";

/**
 * C-Level Session strategies. The orchestrator reads these definitions to
 * build its bounded stage plan — no session behaviour is hardcoded in UI.
 */
export interface SessionStageDef {
  key: "INDEPENDENT" | "SPECIALTY_REVIEW" | "CHALLENGE" | "VOTE" | "SYNTHESIS";
  label: string;
  /** Restrict a stage to particular roles (e.g. CFO for FINANCIAL_REVIEW). */
  leads?: ExecutiveRoleCode[];
  promptKey: string;
}

export interface SessionModeDef {
  mode: SessionMode;
  label: string;
  description: string;
  stages: SessionStageDef[];
  maxRounds: number;
}

/** Used when an Executive Vote is convened with the option fields left empty. */
export const DEFAULT_VOTE_OPTIONS: { id: string; label: string }[] = [
  { id: "A", label: "Proceed" },
  { id: "B", label: "Do not proceed" },
];

const independent: SessionStageDef = { key: "INDEPENDENT", label: "Independent positions", promptKey: "c_suite_session" };
const synthesis: SessionStageDef = { key: "SYNTHESIS", label: "CEO synthesis", leads: ["CEO"], promptKey: "ceo_synthesis" };
const review = (label: string, lead: ExecutiveRoleCode, promptKey: string): SessionStageDef => ({ key: "SPECIALTY_REVIEW", label, leads: [lead], promptKey });

export const SESSION_MODES: Record<SessionMode, SessionModeDef> = {
  EXECUTIVE_ROUND: { mode: "EXECUTIVE_ROUND", label: "Executive Round", description: "Every participating executive gives an independent position.", stages: [independent], maxRounds: 1 },
  CEO_SYNTHESIS: { mode: "CEO_SYNTHESIS", label: "CEO Synthesis", description: "Independent positions, then the CEO integrates them into one recommendation.", stages: [independent, synthesis], maxRounds: 2 },
  RED_TEAM: { mode: "RED_TEAM", label: "Red Team", description: "Positions are stated, then executives challenge each other's assumptions.", stages: [independent, { key: "CHALLENGE", label: "Red-team challenge", promptKey: "red_team" }, synthesis], maxRounds: 3 },
  EVIDENCE_CHECK: { mode: "EVIDENCE_CHECK", label: "Evidence Check", description: "The CTO leads verification of claims and technical evidence.", stages: [independent, review("Evidence check", "CTO", "evidence_check"), synthesis], maxRounds: 3 },
  FINANCIAL_REVIEW: { mode: "FINANCIAL_REVIEW", label: "Financial Review", description: "The CFO performs an explicit financial analysis.", stages: [independent, review("Financial review", "CFO", "financial_review"), synthesis], maxRounds: 3 },
  RISK_REVIEW: { mode: "RISK_REVIEW", label: "Risk Review", description: "The CLO examines legal, governance, compliance and downside concerns.", stages: [independent, review("Risk review", "CLO", "risk_review"), synthesis], maxRounds: 3 },
  OPERATING_REVIEW: { mode: "OPERATING_REVIEW", label: "Operating Review", description: "The CHRO evaluates people, workflow, staffing and execution.", stages: [independent, review("Operating review", "CHRO", "operating_review"), synthesis], maxRounds: 3 },
  MARKET_REVIEW: { mode: "MARKET_REVIEW", label: "Market Review", description: "The CCO evaluates positioning, marketing, sales, brand and PR.", stages: [independent, review("Market review", "CCO", "market_review"), synthesis], maxRounds: 3 },
  IMPACT_REVIEW: { mode: "IMPACT_REVIEW", label: "Impact Review", description: "The Chief Impact Officer analyzes stakeholder and sustainability consequences.", stages: [independent, review("Impact review", "CIO", "impact_review"), synthesis], maxRounds: 3 },
  CONSENSUS: { mode: "CONSENSUS", label: "Consensus", description: "Executives work toward a unified recommendation.", stages: [independent, { key: "CHALLENGE", label: "Convergence round", promptKey: "consensus" }, synthesis], maxRounds: 3 },
  DISSENT: { mode: "DISSENT", label: "Dissent", description: "Meaningful disagreement is explicitly preserved in the record.", stages: [independent, { key: "CHALLENGE", label: "Dissent round", promptKey: "dissent" }, synthesis], maxRounds: 3 },
  EXECUTIVE_VOTE: { mode: "EXECUTIVE_VOTE", label: "Executive Vote", description: "Each executive independently scores the defined options.", stages: [{ key: "VOTE", label: "Executive vote", promptKey: "executive_vote" }, { ...synthesis, promptKey: "vote_synthesis" }], maxRounds: 2 },
  DISCUSS_AND_VOTE: { mode: "DISCUSS_AND_VOTE", label: "Discuss, then Vote", description: "Each executive gives a short position first, then all score the defined options with the discussion in view; the CEO recommends one.", stages: [{ ...independent, label: "Short positions", promptKey: "rapid" }, { key: "VOTE", label: "Executive vote", promptKey: "executive_vote" }, { ...synthesis, promptKey: "vote_synthesis" }], maxRounds: 3 },
  DEEP_DIVE: { mode: "DEEP_DIVE", label: "Deep Dive", description: "Long-form multi-stage session: positions, all specialty reviews, challenge and synthesis.", stages: [independent, review("Financial review", "CFO", "financial_review"), review("Risk review", "CLO", "risk_review"), { key: "CHALLENGE", label: "Red-team challenge", promptKey: "red_team" }, synthesis], maxRounds: 5 },
  RAPID_SESSION: { mode: "RAPID_SESSION", label: "Rapid Session", description: "Short executive analysis with brief positions and a quick synthesis.", stages: [{ ...independent, promptKey: "rapid" }, synthesis], maxRounds: 2 },
};

export const SESSION_LIMITS = {
  maxParticipants: 7,
  maxRounds: 5,
  maxRetries: 1,
  maxTokensPerTurn: 8000,
  requestTimeoutMs: 120_000,
  costBudgetUsd: 5,
} as const;

/** Modes that hold an Executive Vote (and so take a ballot of options). */
export function isVoteMode(mode: SessionMode): boolean {
  return SESSION_MODES[mode].stages.some((s) => s.key === "VOTE");
}
