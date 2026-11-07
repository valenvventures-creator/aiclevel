import { describe, expect, it } from "vitest";
import { SimulatedAdapter } from "@/server/ai/providers/simulated";
import type { GenerateRequest } from "@/server/ai/gateway/types";

async function collect(req: GenerateRequest) {
  let text = "";
  for await (const c of SimulatedAdapter.stream({ ...req, model: "demo-template" })) if (c.type === "text") text += c.text;
  return text;
}

describe("simulated output (demo mode)", () => {
  it("continues an interrupted answer instead of starting over", async () => {
    const base: GenerateRequest = { organizationId: "o", userId: "u", executiveId: "e", taskType: "session_synthesis", executiveRole: "CEO", system: "", messages: [{ role: "user", content: "Should we raise?" }] };
    const full = await collect(base);
    const partial = full.slice(0, 40);
    const rest = await collect({ ...base, messages: [{ role: "user", content: `Should we raise?\n\n<your_answer_so_far>\n${partial}\n</your_answer_so_far>\n\nContinue.` }] });
    expect(partial + rest).toBe(full);
  });
});
