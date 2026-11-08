import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateRequest, StreamChunk } from "@/server/ai/gateway/types";

/**
 * Scripted stand-in for the AI Gateway: emits `words` one at a time, `delayMs`
 * apart, honouring the abort signal like a real streaming provider. A
 * continuation request resumes after the words already written.
 */
const script = { words: [] as string[], delayMs: 0, calls: [] as GenerateRequest[], byTask: {} as Record<string, string[]>, webSources: false };

vi.mock("@/server/ai/gateway", () => ({
  aiGateway: {
    async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
      script.calls.push(req);
      yield { type: "meta", provider: "anthropic", model: "claude-opus-5-5", simulated: false };
      if (script.webSources && req.webResearch) {
        yield { type: "activity", activity: "web_search" };
        yield { type: "sources", sources: [{ url: "https://market.example/uk", title: "UK market 2026", cited: true }] };
      }
      const soFar = /<your_answer_so_far>\n([\s\S]*)\n<\/your_answer_so_far>/.exec(req.messages[0].content)?.[1] ?? "";
      const start = soFar.trim() ? soFar.trim().split(/\s+/).length : 0;
      for (const w of (script.byTask[req.taskType] ?? script.words).slice(start)) {
        await new Promise((r) => setTimeout(r, script.delayMs));
        if (req.signal?.aborted) return;
        yield { type: "text", text: `${w} ` };
      }
      yield { type: "done", stopReason: "end_turn", model: "claude-opus-5-5" };
    },
  },
}));

const { seedExecutivesForOrganization } = await import("@/server/executives/seed");
const { AIExecutiveRegistry } = await import("@/server/executives/registry");
const { startSessionRun, advanceSessionRun, cancelSessionRun } = await import("@/server/ai/orchestration/csuite-orchestrator");
const { db, newId, nowIso } = await import("@/server/db/store");
const { groupVoteRounds } = await import("@/server/sessions/vote-rounds");
const { rememberApprovedDecision } = await import("@/server/decisions/memory");

const org = { id: "org-sessions", name: "Session Test", slug: "session-test", logo_url: null, owner_id: "u1", industry: null, subscription_status: "TRIAL" as const, is_demo: false, created_at: new Date().toISOString() };

async function newSession(status: "ACTIVE" | "RUNNING" = "ACTIVE", mode: "CEO_SYNTHESIS" | "EXECUTIVE_VOTE" | "DISCUSS_AND_VOTE" = "CEO_SYNTHESIS") {
  const execs = await AIExecutiveRegistry.getAllExecutives(org.id);
  const pick = execs.filter((e) => ["CEO", "CFO", "CTO"].includes(e.role_code));
  const id = newId();
  await db().sessions.insert({
    id, organization_id: org.id, project_id: null, created_by: "u1", title: "Seed extension", objective: "Should we raise a seed extension?", mode,
    status, chair_executive_id: pick.find((e) => e.role_code === "CEO")!.id, participant_executive_ids: pick.map((e) => e.id), created_at: nowIso(), started_at: null, ended_at: null,
  });
  return id;
}

async function step(sessionId: string, budgetMs: number) {
  const events: { type: string; state?: string }[] = [];
  for await (const ev of advanceSessionRun({ organization: org, userId: "u1", viewerRole: "OWNER", sessionId, budgetMs })) events.push(ev);
  return { events, state: events.at(-1)?.state };
}

describe("stepwise C-Level Sessions", () => {
  beforeEach(async () => {
    script.calls = [];
    script.byTask = {};
    script.webSources = false;
    await seedExecutivesForOrganization(org.id);
  });

  it("completes a full round across bounded steps, continuing unfinished answers", async () => {
    script.words = Array.from({ length: 12 }, (_, i) => `w${i}`);
    script.delayMs = 8; // ~100 ms per answer against a 40 ms step budget
    const id = await newSession();
    expect((await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Should we raise?" })).state).toBe("started");
    expect((await db().sessions.get(org.id, id))?.status).toBe("RUNNING");

    const states: (string | undefined)[] = [];
    for (let i = 0; i < 30; i++) {
      const r = await step(id, 40);
      states.push(r.state);
      if (r.state !== "continue") break;
    }
    expect(states.at(-1)).toBe("done");
    expect(states.length).toBeGreaterThan(2);

    const messages = await db().sessionMessages.list(org.id, { where: { session_id: id }, orderBy: "sequence_number" });
    const spoken = messages.filter((m) => m.speaker_type === "EXECUTIVE");
    expect(spoken.filter((m) => m.stage === "INDEPENDENT")).toHaveLength(3);
    expect(spoken.filter((m) => m.stage === "SYNTHESIS")).toHaveLength(1);
    // Every answer is complete and was not duplicated by its continuations.
    for (const m of spoken) expect(m.content.trim()).toBe(script.words.join(" "));
    expect(script.calls.some((c) => c.messages[0].content.includes("<your_answer_so_far>"))).toBe(true);

    const done = await db().sessions.get(org.id, id);
    expect(done?.status).toBe("ACTIVE");
    expect(done?.run_state ?? null).toBeNull();
    expect(await db().decisions.list(org.id, { where: { session_id: id } })).toHaveLength(1);
  });

  it("never blocks a session an older version left marked as running", async () => {
    const id = await newSession("RUNNING");
    expect((await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Step 2" })).state).toBe("started");
  });

  it("lets only one step work on a round at a time, and refuses a new question meanwhile", async () => {
    script.words = ["a", "b", "c", "d"];
    script.delayMs = 30;
    const id = await newSession();
    await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Q1" });
    const first = step(id, 400);
    await new Promise((r) => setTimeout(r, 15));
    expect((await step(id, 400)).state).toBe("busy");
    expect((await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Q2" })).state).toBe("busy");
    await first;
  });

  it("replaces an interrupted round with the new question", async () => {
    script.words = Array.from({ length: 10 }, (_, i) => `x${i}`);
    script.delayMs = 10;
    const id = await newSession();
    await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "First question" });
    expect((await step(id, 30)).state).toBe("continue"); // tab closed here: lease released, round unfinished
    const again = await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Second question" });
    expect(again.state).toBe("started");
    const s = await db().sessions.get(org.id, id);
    expect(s?.run_state?.question).toBe("Second question");
    const messages = await db().sessionMessages.list(org.id, { where: { session_id: id } });
    expect(messages.some((m) => m.stage === "INTERRUPTED")).toBe(true);
  });

  it("stops a round on request; later steps find nothing to do", async () => {
    script.words = Array.from({ length: 10 }, (_, i) => `y${i}`);
    script.delayMs = 10;
    const id = await newSession();
    await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Stop me" });
    await step(id, 30);
    expect(await cancelSessionRun({ organization: org, userId: "u1", sessionId: id })).toBe(true);
    const s = await db().sessions.get(org.id, id);
    expect(s?.status).toBe("ACTIVE");
    expect(s?.run_state ?? null).toBeNull();
    expect((await step(id, 30)).state).toBe("idle");
  });

  it("records an executive that cannot respond instead of looping", async () => {
    script.words = ["late"];
    script.delayMs = 200;
    const id = await newSession();
    await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Slow" });
    const states: (string | undefined)[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await step(id, 20);
      states.push(r.state);
      if (r.state !== "continue") break;
    }
    expect(states.at(-1)).toBe("done");
    const messages = await db().sessionMessages.list(org.id, { where: { session_id: id } });
    expect(messages.filter((m) => m.metadata?.failed).length).toBeGreaterThan(0);
    expect(messages.some((m) => m.speaker_type === "EXECUTIVE")).toBe(false);
    expect((await db().sessions.get(org.id, id))?.status).toBe("FAILED");
  });

  it("runs an Executive Vote on the given options and records the CEO's recommended option", async () => {
    script.delayMs = 0;
    script.byTask = { session_vote: ["|", "B", "|", "8", "|", "\nVOTE:", "B", "|", "CONFIDENCE:", "70"], session_synthesis: ["##", "Recommendation\nOption", "B.\n##", "Confidence\n60%\nRECOMMENDED", "OPTION:", "B"] };
    const id = await newSession("ACTIVE", "EXECUTIVE_VOTE");
    const options = [{ id: "A", label: "Raise a seed extension" }, { id: "B", label: "Stay bootstrapped" }];
    await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "How do we fund 2027?", options: { voteOptions: options } });
    for (let i = 0; i < 10; i++) if ((await step(id, 2000)).state !== "continue") break;

    const votes = await db().votes.list(org.id, { where: { session_id: id } });
    expect(votes).toHaveLength(3);
    expect(votes.every((v) => v.option_id === "B")).toBe(true);
    const [decision] = await db().decisions.list(org.id, { where: { session_id: id } });
    expect(decision.options_json).toEqual(options);
    expect(decision.recommended_option).toBe("B");
    expect(decision.recommendation).not.toContain("RECOMMENDED OPTION");
    // The vote prompt listed the real options.
    expect(script.calls.find((c) => c.taskType === "session_vote")?.system).toContain("B: Stay bootstrapped");
  });

  it("votes on Proceed / Do not proceed when the option fields are left empty", async () => {
    script.delayMs = 0;
    script.byTask = { session_vote: ["VOTE:", "A", "|", "CONFIDENCE:", "65"], session_synthesis: ["##", "Recommendation\nProceed."] };
    const id = await newSession("ACTIVE", "EXECUTIVE_VOTE");
    await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Launch in the UK?", options: { voteOptions: [{ id: "A", label: " " }, { id: "B", label: "" }] } });
    for (let i = 0; i < 10; i++) if ((await step(id, 2000)).state !== "continue") break;
    const [question] = await db().sessionMessages.list(org.id, { where: { session_id: id, stage: "QUESTION" } });
    expect(question.metadata.vote_options).toEqual([{ id: "A", label: "Proceed" }, { id: "B", label: "Do not proceed" }]);
    expect(question.metadata.defaulted_options).toBe(true);
    const [decision] = await db().decisions.list(org.id, { where: { session_id: id } });
    // No "RECOMMENDED OPTION" line: the vote leader is used.
    expect(decision.recommended_option).toBe("A");
  });

  it("stores every option's score and the reason with each vote", async () => {
    script.delayMs = 0;
    script.byTask = { session_vote: ["|", "Option", "|", "Score", "|", "Reason", "|\n|---|---|---|\n|", "A", "|", "8", "|", "Runway", "first.", "|\n|", "B", "|", "5", "|", "Slower.", "|\nVOTE:", "A", "|", "CONFIDENCE:", "70"], session_synthesis: ["##", "Recommendation\nA."] };
    const id = await newSession("ACTIVE", "EXECUTIVE_VOTE");
    await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Fund how?", options: { voteOptions: [{ id: "A", label: "Raise" }, { id: "B", label: "Bootstrap" }] } });
    for (let i = 0; i < 10; i++) if ((await step(id, 2000)).state !== "continue") break;
    const [v] = await db().votes.list(org.id, { where: { session_id: id } });
    expect(v.scores_json).toEqual({ A: 8, B: 5 });
    expect(v.score).toBe(8);
    expect(v.reason).toBe("Runway first.");
  });

  it("retries a failed vote as a vote on the same ballot, inside the same round", async () => {
    script.delayMs = 0;
    script.byTask = { session_vote: ["VOTE:", "B", "|", "CONFIDENCE:", "60"], session_synthesis: ["##", "Recommendation\nB."] };
    const id = await newSession("ACTIVE", "EXECUTIVE_VOTE");
    const ballot = [{ id: "A", label: "Raise" }, { id: "B", label: "Bootstrap" }];
    await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Fund how?", options: { voteOptions: ballot } });
    for (let i = 0; i < 10; i++) if ((await step(id, 2000)).state !== "continue") break;
    const cfo = (await AIExecutiveRegistry.getAllExecutives(org.id)).find((e) => e.role_code === "CFO")!;
    await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Fund how?", mode: "EXECUTIVE_VOTE", options: { voteOptions: ballot, onlyExecutiveId: cfo.id, retry: true } });
    for (let i = 0; i < 10; i++) if ((await step(id, 2000)).state !== "continue") break;

    const messages = await db().sessionMessages.list(org.id, { where: { session_id: id }, orderBy: "sequence_number" });
    expect(messages.filter((m) => m.stage === "VOTE" && m.speaker_type === "EXECUTIVE" && m.speaker_id === cfo.id)).toHaveLength(2);
    expect(await db().decisions.list(org.id, { where: { session_id: id } })).toHaveLength(1); // no second decision
    const rounds = groupVoteRounds(messages, await db().votes.list(org.id, { where: { session_id: id } }), await db().decisions.list(org.id, { where: { session_id: id } }));
    expect(rounds).toHaveLength(1);
    expect(rounds[0].votes).toHaveLength(3); // the retry replaced the CFO's earlier vote
  });

  it("discusses before voting in Discuss, then Vote, and the votes see the discussion", async () => {
    script.delayMs = 0;
    script.words = ["Position", "text."];
    script.byTask = { session_vote: ["VOTE:", "A", "|", "CONFIDENCE:", "80"], session_synthesis: ["##", "Recommendation\nA.\nRECOMMENDED", "OPTION:", "A"] };
    const id = await newSession("ACTIVE", "DISCUSS_AND_VOTE");
    await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Expand to the UK?", mode: "DISCUSS_AND_VOTE" });
    for (let i = 0; i < 15; i++) if ((await step(id, 2000)).state !== "continue") break;
    const messages = await db().sessionMessages.list(org.id, { where: { session_id: id }, orderBy: "sequence_number" });
    expect(messages.filter((m) => m.speaker_type === "EXECUTIVE").map((m) => m.stage)).toEqual(["INDEPENDENT", "INDEPENDENT", "INDEPENDENT", "VOTE", "VOTE", "VOTE", "SYNTHESIS"]);
    expect(script.calls.find((c) => c.taskType === "session_vote")?.system).toContain("Position text.");
    const [decision] = await db().decisions.list(org.id, { where: { session_id: id } });
    expect(decision.recommended_option).toBe("A");
  });

  it("saves an approved decision to C-Level Memory as verified, once", async () => {
    const decision = { id: newId(), organization_id: org.id, project_id: null, session_id: null, title: "UK expansion", question: "Expand to the UK?", options_json: [{ id: "A", label: "Proceed" }, { id: "B", label: "Wait" }], chosen_option: "B", recommended_option: "A", recommendation: "Pilot first.", rationale: "Reversible.", risks_json: [], financial_implications_json: null, technology_implications_json: null, people_implications_json: null, impact_implications_json: null, confidence: 0.6, status: "APPROVED" as const, created_by: "u1", created_at: nowIso() };
    await rememberApprovedDecision(decision, "u1");
    await rememberApprovedDecision(decision, "u1");
    const records = await db().memory.list(org.id, { where: { source_id: decision.id } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ status: "VERIFIED", category: "DECISIONS", verified_by: "u1" });
    expect(records[0].content).toContain("Chosen option: B — Wait");
    expect(records[0].content).toContain("The CEO had recommended option A.");
  });

  it("lets granted executives research the web in their positions, with sources kept on the record", async () => {
    script.delayMs = 0;
    script.words = ["Position."];
    script.webSources = true;
    const id = await newSession();
    await startSessionRun({ organization: org, userId: "u1", sessionId: id, userMessage: "Enter the UK?" });
    const activity: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await step(id, 2000);
      activity.push(...r.events.filter((e) => e.type === "activity").map((e) => e.type));
      if (r.state !== "continue") break;
    }
    expect(activity.length).toBeGreaterThan(0);
    const messages = await db().sessionMessages.list(org.id, { where: { session_id: id }, orderBy: "sequence_number" });
    const positions = messages.filter((m) => m.stage === "INDEPENDENT" && m.speaker_type === "EXECUTIVE");
    expect(positions).toHaveLength(3);
    for (const m of positions) {
      expect(m.content).toContain("**Sources (web research)**");
      expect(m.metadata.sources).toEqual([{ url: "https://market.example/uk", title: "UK market 2026", cited: true }]);
    }
    // No web research for the synthesis, and the research rules are in the researching executives' instructions.
    expect(script.calls.find((c) => c.taskType === "session_synthesis")?.webResearch).toBeUndefined();
    expect(script.calls.find((c) => c.taskType === "session_position")?.system).toContain("WEB RESEARCH");
  });
});
