import "server-only";
import type { GenerateRequest, ProviderAdapter, StreamChunk } from "../gateway/types";

export const SIMULATED_BANNER = "> **Simulated response — demo mode.** No A.I. provider is connected, so this text comes from a deterministic template, not a live model. Connect Anthropic or OpenAI in Settings → AI Models for real executive analysis.";

const ROLE_LENS: Record<string, { lens: string; risk: string; need: string; metric: string }> = {
  CEO: { lens: "long-term advantage and alignment with our mission", risk: "committing focus to something that does not compound", need: "a clear owner and a 90-day success definition", metric: "strategic progress against current priorities" },
  CFO: { lens: "cash, runway and return on capital", risk: "costs front-loaded before revenue is proven", need: "a costed base / upside / downside model", metric: "payback period and runway impact" },
  CCO: { lens: "audience, positioning and conversion", risk: "a message that is unclear or over-promises", need: "evidence of audience demand and a proof point", metric: "qualified pipeline and message recall" },
  CHRO: { lens: "ownership, capacity and operating rhythm", risk: "no accountable owner and an overloaded team", need: "a RACI and a staffing plan", metric: "on-time delivery against milestones" },
  CTO: { lens: "feasibility, security and scalability", risk: "technical debt or security exposure from moving too fast", need: "a small technical spike to validate assumptions", metric: "time to first working version and incident rate" },
  CLO: { lens: "governance, legal exposure and downside protection", risk: "unreviewed contractual or regulatory obligations", need: "documentation of the decision and counsel review where required", metric: "open high-severity risks" },
  CIO: { lens: "stakeholder benefit and measurable impact", risk: "impact claims we cannot substantiate", need: "a theory of change and baseline metrics", metric: "beneficiary outcomes against baseline" },
};

function lastUser(req: GenerateRequest) {
  return [...req.messages].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
}

function compose(req: GenerateRequest): string {
  const role = (req.executiveRole ?? "CEO").toUpperCase();
  const lens = ROLE_LENS[role] ?? ROLE_LENS.CEO;
  const ask = lastUser(req).split("\n")[0].slice(0, 220) || "the matter in front of us";
  switch (req.taskType) {
    case "session_vote":
      return `${SIMULATED_BANNER}\n\n| Option | Score | Reason |\n|---|---|---|\n| A | 7 | Strongest on ${lens.lens}. |\n| B | 5 | Viable, but ${lens.risk}. |\n\nVOTE: A | CONFIDENCE: 60`;
    case "session_synthesis":
      return `${SIMULATED_BANNER}\n\n## Recommendation\nProceed in a staged, reversible way with a defined pilot before full commitment.\n\n## Rationale\nThe executive positions converge on value, but each seat raised a condition that a pilot can test cheaply.\n\n## Where the C-Suite agrees\n- The opportunity is aligned with current priorities.\n- A named owner and explicit success metrics are required.\n\n## Preserved dissent\n- Template output cannot represent genuine dissent; a live model will preserve real disagreement here.\n\n## Key risks\n| Risk | Severity | Owner |\n|---|---|---|\n| Unvalidated assumptions | MEDIUM | CEO |\n| Unreviewed obligations | MEDIUM | CLO |\n\n## Next steps\n| Action | Owner | When |\n|---|---|---|\n| Define pilot scope and metrics | CHRO | 1 week |\n| Build base/upside/downside model | CFO | 2 weeks |\n\n## Confidence\n55% — simulated; connect a provider for a real synthesis.`;
    case "studio_production":
      return `${SIMULATED_BANNER}\n\n# ${ask}\n\n## Executive summary\nThis is a structural draft produced in demo mode. It shows the shape of the Finished Work the lead executive will deliver once a provider is connected.\n\n## Analysis through the lens of ${lens.lens}\n- Situation and objective\n- Options considered\n- Recommended approach\n\n## Assumptions\n- No live organizational analysis was performed.\n\n## Human review checklist\n- [ ] Validate figures and facts\n- [ ] Confirm brand voice\n- [ ] Approve before any external use`;
    default:
      return `${SIMULATED_BANNER}\n\n**Position:** From my seat — ${lens.lens} — I would approach "${ask}" deliberately, with a clear owner and measurable checkpoints.\n\n**Reasoning**\n- The first question I ask is how this affects ${lens.lens}.\n- The main risk I see is ${lens.risk}.\n- Before committing, I need ${lens.need}.\n\n**Metric to watch:** ${lens.metric}.\n\n**Confidence:** Not assessed — this is template output, not live analysis.`;
  }
}

/** Deterministic, clearly-labelled simulation used only when no provider is configured. */
export const SimulatedAdapter: ProviderAdapter = {
  id: "simulated",
  isAvailable: () => true,
  async *stream(req): AsyncIterable<StreamChunk> {
    yield { type: "meta", provider: "simulated", model: "demo-template", simulated: true };
    let text = compose(req);
    // A continuation request (Studio or C-Suite Session step) resumes after what was already written.
    const soFar = /<(?:draft_so_far|your_answer_so_far)>\n([\s\S]*)\n<\/(?:draft_so_far|your_answer_so_far)>/.exec(lastUser(req))?.[1];
    if (soFar && text.startsWith(soFar)) text = text.slice(soFar.length);
    const words = text.split(/(\s+)/);
    for (let i = 0; i < words.length; i += 6) {
      if (req.signal?.aborted) return;
      yield { type: "text", text: words.slice(i, i + 6).join("") };
      await new Promise((r) => setTimeout(r, 18));
    }
    yield { type: "done", usage: { input_tokens: 0, output_tokens: 0 }, model: "demo-template", stopReason: "end_turn" };
  },
};
