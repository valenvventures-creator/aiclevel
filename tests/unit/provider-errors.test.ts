import { afterEach, describe, expect, it, vi } from "vitest";
import { providerErrorFromStatus } from "@/server/ai/gateway/types";
import { summarizeFailures } from "@/server/ai/gateway";

describe("provider error reporting", () => {
  it("names the provider and the setting to fix on a rejected key", () => {
    const e = providerErrorFromStatus("openai", 401, "gpt-5");
    expect(e.message).toContain("OpenAI rejected the API key (401)");
    expect(e.message).toContain("OPENAI_API_KEY");
    expect(e.kind).toBe("auth");
    expect(e.retryable).toBe(false);
    expect(providerErrorFromStatus("anthropic", 401, "claude-opus-5-5").message).toContain("ANTHROPIC_API_KEY");
  });

  it("classifies permission, missing model, rate limit and outages", () => {
    expect(providerErrorFromStatus("anthropic", 403, "m").kind).toBe("permission");
    expect(providerErrorFromStatus("openai", 404, "gpt-x").message).toContain('"gpt-x"');
    expect(providerErrorFromStatus("openai", 429, "m").retryable).toBe(true);
    expect(providerErrorFromStatus("anthropic", 529, "m").kind).toBe("server");
  });

  it("reports every provider that was tried, not just the last one", () => {
    const msg = summarizeFailures(["Claude (Anthropic) rejected the API key (401).", "OpenAI rejected the API key (401)."]);
    expect(msg).toContain("Claude (Anthropic)");
    expect(msg).toContain("OpenAI");
  });
});

describe("OpenAI adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("turns a 401 into an actionable error without echoing key material", async () => {
    process.env.OPENAI_API_KEY = "sk-test-not-real";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Incorrect API key provided: sk-tes***real", code: "invalid_api_key" } }), { status: 401 })),
    );
    vi.resetModules();
    const { OpenAIAdapter } = await import("@/server/ai/providers/openai");
    const run = async () => {
      for await (const chunk of OpenAIAdapter.stream({ organizationId: "o", userId: "u", executiveId: null, taskType: "studio_production", system: "s", messages: [{ role: "user", content: "hi" }], model: "gpt-5" })) void chunk;
    };
    await expect(run()).rejects.toThrow(/OpenAI rejected the API key \(401\)/);
    await expect(run()).rejects.not.toThrow(/sk-/);
  });
});
