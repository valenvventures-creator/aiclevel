import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeSources, sourcesMarkdown, stripSourcesSection, webResearchFor } from "@/server/ai/web-research";
import { parseMarkdown } from "@/server/export/document";

describe("web research policy", () => {
  const granted = { model: { tool_permissions: ["search_memory", "web_research"] } };
  const notGranted = { model: { tool_permissions: ["search_memory"] } };

  it("allows bounded searching only for executives granted web research, on research tasks", () => {
    expect(webResearchFor(granted, "executive_conversation")).toEqual({ maxUses: 5 });
    expect(webResearchFor(granted, "session_position")).toEqual({ maxUses: 3 });
    expect(webResearchFor(notGranted, "executive_conversation")).toBeUndefined();
    expect(webResearchFor(granted, "session_vote")).toBeUndefined();
    expect(webResearchFor(granted, "session_synthesis")).toBeUndefined();
    expect(webResearchFor(granted, "studio_production", { continuing: true })).toBeUndefined();
  });

  it("merges sources by URL, keeps a page cited once cited, and ignores non-web links", () => {
    let s = mergeSources([], [{ url: "https://a.example/x", title: "A", cited: false }, { url: "javascript:alert(1)", title: "bad", cited: true }]);
    s = mergeSources(s, [{ url: "https://a.example/x", title: "", cited: true }, { url: "https://b.example", title: "B", cited: false }]);
    expect(s).toEqual([{ url: "https://a.example/x", title: "A", cited: true }, { url: "https://b.example", title: "B", cited: false }]);
  });

  it("lists cited pages (or consulted pages when none are cited) as a readable Sources section", () => {
    const md = sourcesMarkdown([{ url: "https://a.example/x", title: "Report [2026]", cited: true }, { url: "https://b.example", title: "B", cited: false }]);
    expect(md).toContain("**Sources (web research)**");
    expect(md).toContain("1. [Report 2026](https://a.example/x)");
    expect(md).not.toContain("b.example");
    expect(sourcesMarkdown([{ url: "https://b.example", title: "B", cited: false }])).toContain("Sources consulted");
    expect(sourcesMarkdown([])).toBe("");
    const blocks = parseMarkdown(`Answer.${md}`);
    expect(blocks.some((b) => b.type === "list")).toBe(true);
    expect(stripSourcesSection(`Answer.${md}`)).toBe("Answer.");
  });
});

/* ---------------------------------------------------------------- */
/* The Claude adapter, against a scripted Anthropic SDK              */
/* ---------------------------------------------------------------- */

const sdk = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[], script: [] as { events: unknown[]; final: Record<string, unknown> }[], rejectWeb: false }));

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
  class BadRequestError extends APIError {}
  class APIUserAbortError extends Error {}
  class APIConnectionError extends Error {}
  class Anthropic {
    static APIError = APIError;
    static BadRequestError = BadRequestError;
    static APIUserAbortError = APIUserAbortError;
    static APIConnectionError = APIConnectionError;
    beta = {
      messages: {
        stream: (params: Record<string, unknown>) => {
          sdk.calls.push(params);
          if (sdk.rejectWeb && params.tools) {
            return {
              async *[Symbol.asyncIterator]() {
                throw new BadRequestError(400, "web_search is not enabled for this organization");
              },
              finalMessage: async () => ({}),
            };
          }
          const turn = sdk.script.shift() ?? { events: [], final: { stop_reason: "end_turn", content: [], model: "claude-opus-5-5", usage: { input_tokens: 1, output_tokens: 1 } } };
          return {
            async *[Symbol.asyncIterator]() {
              for (const e of turn.events) yield e;
            },
            finalMessage: async () => turn.final,
          };
        },
      },
    };
  }
  return { default: Anthropic };
});

process.env.ANTHROPIC_API_KEY = "test-key";
const { AnthropicAdapter } = await import("@/server/ai/providers/anthropic");

const text = (t: string) => ({ type: "content_block_delta", delta: { type: "text_delta", text: t } });
const final = (stop: string, content: unknown[] = [], searches = 0) => ({ stop_reason: stop, content, model: "claude-opus-5-5", usage: { input_tokens: 10, output_tokens: 5, server_tool_use: { web_search_requests: searches } } });
const req = { organizationId: "o", userId: "u", executiveId: "e", taskType: "executive_conversation" as const, system: "s", messages: [{ role: "user" as const, content: "UK SaaS market size?" }], model: "claude-opus-5-5" };

async function collect(r: Parameters<typeof AnthropicAdapter.stream>[0]) {
  const out: Awaited<ReturnType<typeof AnthropicAdapter.stream> extends AsyncIterable<infer T> ? T : never>[] = [];
  for await (const c of AnthropicAdapter.stream(r)) out.push(c);
  return out;
}

describe("Claude adapter web research", () => {
  beforeEach(() => {
    sdk.calls = [];
    sdk.script = [];
    sdk.rejectWeb = false;
  });

  it("offers the web search tool only when allowed, and streams searches, sources and citations", async () => {
    sdk.script.push({
      events: [
        { type: "content_block_start", content_block: { type: "server_tool_use", name: "web_search" } },
        { type: "content_block_start", content_block: { type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://stats.example/uk", title: "UK SaaS 2026" }] } },
        text("About £30bn."),
        { type: "content_block_delta", delta: { type: "citations_delta", citation: { type: "web_search_result_location", url: "https://stats.example/uk", title: "UK SaaS 2026" } } },
      ],
      final: final("end_turn", [], 1),
    });
    const out = await collect({ ...req, webResearch: { maxUses: 5 } });
    expect(sdk.calls[0].tools).toEqual([{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]);
    expect(out.map((c) => c.type)).toEqual(["meta", "activity", "sources", "text", "sources", "done"]);
    expect(out.find((c) => c.type === "sources" && c.sources?.[0].cited)?.sources?.[0].url).toBe("https://stats.example/uk");
    expect(out.at(-1)?.usage?.web_search_requests).toBe(1);

    await collect(req);
    expect(sdk.calls[1].tools).toBeUndefined();
  });

  it("resumes a paused search turn by sending it back unchanged", async () => {
    const paused = [{ type: "server_tool_use", id: "t1", name: "web_search", input: { query: "uk saas" } }];
    sdk.script.push({ events: [], final: final("pause_turn", paused, 1) }, { events: [text("Done.")], final: final("end_turn", [], 1) });
    const out = await collect({ ...req, webResearch: { maxUses: 3 } });
    expect(sdk.calls).toHaveLength(2);
    expect((sdk.calls[1].messages as unknown[]).at(-1)).toEqual({ role: "assistant", content: paused });
    expect(out.filter((c) => c.type === "text").map((c) => c.text).join("")).toBe("Done.");
    expect(out.at(-1)?.usage?.web_search_requests).toBe(2);
  });

  it("answers without web research when web search is switched off for the Claude account", async () => {
    sdk.rejectWeb = true;
    sdk.script.push({ events: [text("From internal data.")], final: final("end_turn") });
    const out = await collect({ ...req, webResearch: { maxUses: 5 } });
    expect(out.some((c) => c.type === "meta" && c.text?.includes("Web research is not enabled"))).toBe(true);
    expect(out.filter((c) => c.type === "text").map((c) => c.text).join("")).toBe("From internal data.");
    expect(sdk.calls.at(-1)?.tools).toBeUndefined();
  });
});
