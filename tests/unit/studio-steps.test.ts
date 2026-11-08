import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateRequest, StreamChunk } from "@/server/ai/gateway/types";

/**
 * Scripted stand-in for the AI Gateway: emits `words` one at a time, `delayMs`
 * apart, honouring the abort signal exactly like a real streaming provider.
 */
const script = { words: [] as string[], delayMs: 0, calls: [] as GenerateRequest[] };

vi.mock("@/server/ai/gateway", () => ({
  aiGateway: {
    async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
      script.calls.push(req);
      yield { type: "meta", provider: "anthropic", model: "claude-opus-5-5", simulated: false };
      const alreadyWritten = /<draft_so_far>\n([\s\S]*)\n<\/draft_so_far>/.exec(req.messages[0].content)?.[1] ?? "";
      const start = alreadyWritten.trim() ? alreadyWritten.trim().split(/\s+/).length : 0;
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
const { createProductionJob, advanceProductionJob } = await import("@/server/studio/service");
const { db } = await import("@/server/db/store");

const org = { id: "org-studio", name: "Studio Test", slug: "studio-test", logo_url: null, owner_id: "u1", industry: null, subscription_status: "TRIAL" as const, is_demo: false, created_at: new Date().toISOString() };

describe("stepwise C-Level Studio production", () => {
  beforeEach(async () => {
    script.calls = [];
    await seedExecutivesForOrganization(org.id);
  });

  it("finishes long work across several bounded steps and keeps the draft between them", async () => {
    script.words = Array.from({ length: 12 }, (_, i) => `w${i}`);
    script.delayMs = 10; // ~120 ms of output against a 45 ms step budget
    const job = await createProductionJob({ organization: org, userId: "u1", request: "Develop a fundraising strategy." });

    const states: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await advanceProductionJob({ organization: org, userId: "u1", viewerRole: "OWNER", jobId: job.id, budgetMs: 45 });
      states.push(r.state);
      if (r.state !== "continue") break;
    }

    expect(states[0]).toBe("continue");
    expect(states.at(-1)).toBe("done");
    const [artifact] = await db().artifacts.list(org.id, { where: { job_id: job.id } });
    expect(artifact.content.trim()).toBe(script.words.join(" "));
    const done = await db().productionJobs.get(org.id, job.id);
    expect(done?.status).toBe("AWAITING_REVIEW");
    expect(done?.metadata.draft).toBe("");
    // Continuation steps were sent the saved draft.
    expect(script.calls.slice(1).every((c) => c.messages[0].content.includes("<draft_so_far>"))).toBe(true);
  });

  it("fails clearly instead of looping when nothing is written within the time limit", async () => {
    script.words = ["late"];
    script.delayMs = 200;
    const job = await createProductionJob({ organization: org, userId: "u1", request: "Create our marketing campaign." });
    const a = await advanceProductionJob({ organization: org, userId: "u1", viewerRole: "OWNER", jobId: job.id, budgetMs: 20 });
    const b = await advanceProductionJob({ organization: org, userId: "u1", viewerRole: "OWNER", jobId: job.id, budgetMs: 20 });
    expect(a.state).toBe("continue");
    expect(b.state).toBe("failed");
    expect((await db().productionJobs.get(org.id, job.id))?.status).toBe("FAILED");
  });

  it("lets only one runner work on a job at a time", async () => {
    script.words = ["a", "b", "c"];
    script.delayMs = 30;
    const job = await createProductionJob({ organization: org, userId: "u1", request: "Draft an HR policy." });
    const first = advanceProductionJob({ organization: org, userId: "u1", viewerRole: "OWNER", jobId: job.id, budgetMs: 500 });
    await new Promise((r) => setTimeout(r, 10));
    const second = await advanceProductionJob({ organization: org, userId: "u1", viewerRole: "OWNER", jobId: job.id, budgetMs: 500 });
    expect(second.state).toBe("busy");
    expect((await first).state).toBe("done");
  });
});
