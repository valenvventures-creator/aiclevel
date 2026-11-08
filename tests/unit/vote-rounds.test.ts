import { describe, expect, it } from "vitest";
import { groupVoteRounds, voteRoundMarkdown } from "@/server/sessions/vote-rounds";
import { parseSuggestedOptions } from "@/server/sessions/suggest-options";
import { parseMarkdown } from "@/server/export/document";
import type { CSuiteSessionMessage, CSuiteVote, Decision } from "@/types/domain";

const at = (m: number) => new Date(Date.UTC(2026, 10, 7, 12, m)).toISOString();
const q = (id: string, m: number, metadata: Record<string, unknown>) => ({ id, stage: "QUESTION", content: `Question ${id}`, created_at: at(m), metadata }) as Pick<CSuiteSessionMessage, "id" | "stage" | "content" | "created_at" | "metadata">;
const vote = (id: string, exec: string, option: string, m: number): CSuiteVote => ({ id, organization_id: "o", session_id: "s", executive_id: exec, option_id: option, score: 7, reason: `Because ${id}`, confidence: 0.6, created_at: at(m), scores_json: { A: 7, B: 5 } });
const decision = (id: string, m: number, recommended: string | null): Decision => ({ id, organization_id: "o", project_id: null, session_id: "s", title: "T", question: "Q", options_json: [{ id: "A", label: "Raise" }, { id: "B", label: "Bootstrap" }], chosen_option: null, recommended_option: recommended, recommendation: "R", rationale: "", risks_json: [], financial_implications_json: null, technology_implications_json: null, people_implications_json: null, impact_implications_json: null, confidence: 0.6, status: "PROPOSED", created_by: "u", created_at: at(m) });
const ballot = [{ id: "A", label: "Raise" }, { id: "B", label: "Bootstrap" }];

describe("vote rounds", () => {
  const messages = [
    q("q1", 0, { vote_options: ballot }),
    q("q-other", 5, {}), // a non-vote question does not split rounds
    q("q-retry", 6, { vote_options: ballot, single_executive: true, retry: true }), // a retry joins its round
    q("q2", 10, { vote_options: [{ id: "A", label: "Proceed" }, { id: "B", label: "Do not proceed" }], defaulted_options: true }),
  ];
  const votes = [vote("v1", "cfo", "A", 1), vote("v2", "clo", "B", 1), vote("v3", "cfo", "B", 7), vote("v4", "cfo", "A", 11)];
  const decisions = [decision("d1", 2, "A"), decision("d2", 12, null)];
  const rounds = groupVoteRounds(messages, votes, decisions);

  it("splits rounds at vote questions and keeps a retried vote in its round (latest vote per executive)", () => {
    expect(rounds).toHaveLength(2);
    expect(rounds[0].votes.map((v) => v.id).sort()).toEqual(["v2", "v3"]);
    expect(rounds[0].decision?.id).toBe("d1");
    expect(rounds[1].votes.map((v) => v.id)).toEqual(["v4"]);
    expect(rounds[1].defaulted).toBe(true);
  });

  it("reports ties", () => {
    expect(rounds[0].tied).toEqual([]); // B has both votes after the retry
    const tie = groupVoteRounds([q("q1", 0, { vote_options: ballot })], [vote("a", "cfo", "A", 1), vote("b", "clo", "B", 1)], []);
    expect(tie[0].tied).toEqual(["A", "B"]);
  });

  it("writes a readable 'How the C-Level voted' section with real tables", () => {
    const md = voteRoundMarkdown(rounds[0], (id) => id.toUpperCase());
    expect(md).toContain("**A** — Raise _(CEO recommends)_");
    expect(md).toContain("| CLO | B — Bootstrap | 60% | Because v2 |");
    expect(parseMarkdown(md).filter((b) => b.type === "table")).toHaveLength(2);
  });
});

describe("suggested options", () => {
  it("reads lettered lines in their common forms and re-letters them", () => {
    expect(parseSuggestedOptions("Here you go:\nA: Raise a seed extension\n**B.** Stay bootstrapped\n- Option C) Take a loan\nnot an option")).toEqual([
      { id: "A", label: "Raise a seed extension" },
      { id: "B", label: "Stay bootstrapped" },
      { id: "C", label: "Take a loan" },
    ]);
  });
});
