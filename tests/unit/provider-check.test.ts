import { afterEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ outcome: "ok" as "ok" | "auth" | "credit" | "network" }));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status: number;
    error: unknown;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.error = { error: { message } };
    }
  }
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class RateLimitError extends APIError {}
  class BadRequestError extends APIError {}
  class APIConnectionError extends Error {}
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    static RateLimitError = RateLimitError;
    static BadRequestError = BadRequestError;
    static APIConnectionError = APIConnectionError;
    static APIUserAbortError = class extends Error {};
    messages = {
      create: async () => {
        if (sdk.outcome === "auth") throw new AuthenticationError(401, "invalid x-api-key");
        if (sdk.outcome === "credit") throw new BadRequestError(400, "Your credit balance is too low to access the Anthropic API.");
        if (sdk.outcome === "network") throw new APIConnectionError("Connection error.");
        return { content: [] };
      },
    };
  }
  return { default: Anthropic };
});

// Pasted with quotes, a trailing line break and a space — all of which are removed.
process.env.ANTHROPIC_API_KEY = ` "sk-ant-api03-${"a".repeat(80)}WXYZ"\n`;
process.env.OPENAI_API_KEY = "sk-proj-" + "b".repeat(60) + "abcd";
const { checkProvider, formatProblem, maskKey } = await import("@/server/ai/provider-check");
const { env } = await import("@/lib/env");

afterEach(() => {
  sdk.outcome = "ok";
  vi.unstubAllGlobals();
});

describe("provider connection check", () => {
  it("cleans pasted keys and shows only a masked hint", () => {
    expect(env.anthropicApiKey).toBe(`sk-ant-api03-${"a".repeat(80)}WXYZ`);
    expect(maskKey(env.anthropicApiKey)).toBe("sk-ant-api03-…WXYZ (97 characters)");
  });

  it("catches keys in the wrong place before calling anyone", () => {
    expect(formatProblem("openai", "sk-ant-api03-" + "x".repeat(40))).toMatch(/Anthropic key, not an OpenAI key/);
    expect(formatProblem("anthropic", "sk-ant-admin01-" + "x".repeat(40))).toMatch(/Admin key/);
    expect(formatProblem("anthropic", "sk-ant-api03-short")).toMatch(/too short/);
    expect(formatProblem("anthropic", "sk-ant-api03-" + "x".repeat(40))).toBeNull();
  });

  it("explains a rejected Anthropic key, an empty balance and a network failure differently", async () => {
    expect((await checkProvider("anthropic")).ok).toBe(true);
    sdk.outcome = "auth";
    const auth = await checkProvider("anthropic");
    expect(auth.message).toMatch(/rejected this key \(401\)/);
    expect(auth.steps?.[1]).toMatch(/ANTHROPIC_API_KEY/);
    sdk.outcome = "credit";
    expect((await checkProvider("anthropic")).message).toMatch(/no credit/);
    sdk.outcome = "network";
    expect((await checkProvider("anthropic")).message).toMatch(/could not connect to Anthropic/);
  });

  it("passes on OpenAI's own (masked) explanation of a 401", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: "Incorrect API key provided: sk-proj-****abcd." } }), { status: 401 }));
    const r = await checkProvider("openai");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/OpenAI rejected this key \(401\)/);
    expect(r.message).toContain("Incorrect API key provided");
    expect(r.keyHint).toBe("sk-proj-…abcd (72 characters)");
  });
});
