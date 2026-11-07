import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { ProviderError, providerErrorFromStatus, type GenerateRequest, type ProviderAdapter, type StreamChunk } from "../gateway/types";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: env.anthropicApiKey, maxRetries: 2 }));

/**
 * Anthropic (Claude) adapter — the primary reasoning provider.
 * Uses adaptive thinking with per-executive effort, streaming, and the
 * server-side refusal fallback ("default" routing) so a declined request is
 * transparently re-run on a fallback Claude model inside the same call.
 * When the request allows web research, Claude's server-side web search tool
 * is offered (bounded by max_uses); searches, found pages and citations are
 * streamed as "activity" and "sources" chunks.
 */
/** A server-side web search turn can pause; it is resumed at most this many times. */
const MAX_PAUSE_RESUMES = 3;

type LooseEvent = {
  type: string;
  content_block?: { type: string; name?: string; content?: unknown };
  delta?: { type: string; text?: string; citation?: { type?: string; url?: string; title?: string } };
};

type ResultItem = { type?: string; url?: string; title?: string };

export const AnthropicAdapter: ProviderAdapter = {
  id: "anthropic",
  isAvailable: () => Boolean(env.anthropicApiKey),
  async *stream(req: GenerateRequest & { model: string }): AsyncIterable<StreamChunk> {
    // Claude's server-side web search: runs on Anthropic's side, bounded by max_uses, results cited.
    const tools = req.webResearch ? [{ type: "web_search_20260209", name: "web_search", max_uses: req.webResearch.maxUses }] : undefined;
    const base = {
      model: req.model,
      max_tokens: req.maxTokens ?? 16000,
      system: req.system,
      thinking: { type: "adaptive" as const },
      output_config: { effort: req.modelPreference?.effort ?? "high" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(tools ? { tools } : {}),
    };
    let messages: unknown[] = req.messages;
    const usage = { input_tokens: 0, output_tokens: 0, web_search_requests: 0 };
    let emittedText = false;
    try {
      yield { type: "meta", provider: "anthropic", model: req.model, simulated: false };
      for (let resume = 0; ; resume++) {
        // Cast: newer request fields (output_config.effort, fallbacks, web_search_20260209) may post-date the installed SDK's types.
        const stream = getClient().beta.messages.stream({ ...base, messages } as unknown as Parameters<Anthropic["beta"]["messages"]["stream"]>[0], { signal: req.signal });
        for await (const raw of stream) {
          const event = raw as unknown as LooseEvent;
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
            emittedText = true;
            yield { type: "text", text: event.delta.text };
          } else if (event.type === "content_block_start" && event.content_block?.type === "server_tool_use" && event.content_block.name === "web_search") {
            yield { type: "activity", activity: "web_search" };
          } else if (event.type === "content_block_start" && event.content_block?.type === "web_search_tool_result" && Array.isArray(event.content_block.content)) {
            // A list is a success; an error comes back as a single object and is left to the model.
            const found = (event.content_block.content as ResultItem[]).filter((r) => r.type === "web_search_result" && r.url).map((r) => ({ url: r.url!, title: r.title ?? r.url!, cited: false }));
            if (found.length) yield { type: "sources", sources: found };
          } else if (event.type === "content_block_delta" && event.delta?.type === "citations_delta" && event.delta.citation?.type === "web_search_result_location" && event.delta.citation.url) {
            yield { type: "sources", sources: [{ url: event.delta.citation.url, title: event.delta.citation.title ?? event.delta.citation.url, cited: true }] };
          }
        }
        const final = await stream.finalMessage();
        usage.input_tokens += final.usage.input_tokens;
        usage.output_tokens += final.usage.output_tokens;
        usage.web_search_requests += (final.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0;
        // A long server-side search turn pauses; send the turn back unchanged and the server resumes it.
        if (final.stop_reason === "pause_turn" && resume < MAX_PAUSE_RESUMES) {
          messages = [...messages, { role: "assistant", content: final.content }];
          continue;
        }
        if (final.stop_reason === "refusal") {
          yield { type: "error", error: "The request was declined by the model's safety system." };
        }
        yield { type: "done", stopReason: final.stop_reason === "pause_turn" ? "end_turn" : (final.stop_reason ?? undefined), model: final.model, usage };
        return;
      }
    } catch (err) {
      if (err instanceof Anthropic.APIUserAbortError) throw err;
      // Web search can be switched off for a Claude account; answer without it rather than fail.
      if (tools && !emittedText && err instanceof Anthropic.BadRequestError && /web[_ ]?search/i.test(err.message)) {
        yield { type: "meta", text: "Web research is not enabled for this Claude account, so this answer uses your organization's information only. An administrator can turn on web search in the Claude Console." };
        yield* AnthropicAdapter.stream({ ...req, webResearch: undefined });
        return;
      }
      if (err instanceof Anthropic.APIConnectionError) throw new ProviderError("anthropic", "Claude (Anthropic) could not be reached from the server.", true, "network");
      if (err instanceof Anthropic.APIError && typeof err.status === "number") {
        const typed = (err.error as { error?: { message?: string } } | undefined)?.error?.message;
        throw providerErrorFromStatus("anthropic", err.status, req.model, err.status === 400 ? typed : undefined);
      }
      throw new ProviderError("anthropic", err instanceof Error ? err.message : "Unknown Claude (Anthropic) error", true, "unknown");
    }
  },
};
