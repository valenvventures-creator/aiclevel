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
 */
export const AnthropicAdapter: ProviderAdapter = {
  id: "anthropic",
  isAvailable: () => Boolean(env.anthropicApiKey),
  async *stream(req: GenerateRequest & { model: string }): AsyncIterable<StreamChunk> {
    const params = {
      model: req.model,
      max_tokens: req.maxTokens ?? 16000,
      system: req.system,
      messages: req.messages,
      thinking: { type: "adaptive" as const },
      output_config: { effort: req.modelPreference?.effort ?? "high" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    };
    try {
      // Cast: newer request fields (output_config.effort, fallbacks) may post-date the installed SDK's types.
      const stream = getClient().beta.messages.stream(params as unknown as Parameters<Anthropic["beta"]["messages"]["stream"]>[0], { signal: req.signal });
      yield { type: "meta", provider: "anthropic", model: req.model, simulated: false };
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") {
        yield { type: "error", error: "The request was declined by the model's safety system." };
      }
      yield { type: "done", stopReason: final.stop_reason ?? undefined, model: final.model, usage: { input_tokens: final.usage.input_tokens, output_tokens: final.usage.output_tokens } };
    } catch (err) {
      if (err instanceof Anthropic.APIUserAbortError) throw err;
      if (err instanceof Anthropic.APIConnectionError) throw new ProviderError("anthropic", "Claude (Anthropic) could not be reached from the server.", true, "network");
      if (err instanceof Anthropic.APIError && typeof err.status === "number") {
        const typed = (err.error as { error?: { message?: string } } | undefined)?.error?.message;
        throw providerErrorFromStatus("anthropic", err.status, req.model, err.status === 400 ? typed : undefined);
      }
      throw new ProviderError("anthropic", err instanceof Error ? err.message : "Unknown Claude (Anthropic) error", true, "unknown");
    }
  },
};
