import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateRequest, StreamChunk } from "@/server/ai/gateway/types";

/**
 * Scripted stand-in for the AI Gateway: emits `words` one at a time, `delayMs`
 * apart, honouring the abort signal like a real streaming provider. A
 * continuation request resumes after the words already written.
 */
const script = { words: [] as string[], delayMs: 0, calls: [] as GenerateRequest[] };

vi.mock("@/server/ai/gateway", () => ({
  aiGateway: {
    async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
      script.calls.push(req);
      yield { type: "meta", provider: "anthropic", model: "claude-opus-5-5", simulated: false };
      const soFar = /<your_answer_so_far>\n([\s\S]*)\n<\/your_answer_so_far>/.exec(req.messages[0].content)?.[1] ?? "";
      const start = soFar.trim() ? soFar.trim().split(/\s+/).length : 0;
      for (const w of script.words.slice(start)) {
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

const org = { id: "org-sessions", name: "Session Test", slug: "session-test", logo_url: null, owner_id: "u1", industry: null, subscription_status: "TRIAL" as const, is_demo: false, created_at: new Date().toISOString() };

async function newSession(status: "ACTIVE" | "RUNNING" = "ACTIVE") {
  const execs = await AIExecutiveRegistry.getAllExecutives(org.id);
  const pick = execs.filter((e) => ["CEO", "CFO", "CTO"].includes(e.role_code));
  const id = newId();
  await db().sessions.insert({
    id, organization_id: org.id, project_id: null, created_by: "u1", title: "Seed extension", objective: "Should we raise a seed extension?", mode: "CEO_SYNTHESIS",
    status, chair_executive_id: pick.find((e) => e.role_code === "CEO")!.id, participant_executive_ids: pick.map((e) => e.id), created_at: nowIso(), started_at: null, ended_at: null,
  });
  return id;
}

async function step(sessionId: string, budgetMs: number) {
  const events: { type: string; state?: string }[] = [];
  for await (const ev of advanceSessionRun({ organization: org, userId: "u1", viewerRole: "OWNER", sessionId, budgetMs })) events.push(ev);
  return { events, state: events.at(-1)?.state };
}

describe("stepwise C-Suite Sessions", () => {
  beforeEach(async () => {
    script.calls = [];
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
});
