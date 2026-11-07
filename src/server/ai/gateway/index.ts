import "server-only";
import { randomUUID } from "node:crypto";
import { db, newId, nowIso } from "@/server/db/store";
import { AnthropicAdapter } from "../providers/anthropic";
import { OpenAIAdapter } from "../providers/openai";
import { SimulatedAdapter } from "../providers/simulated";
import { estimateCost, routeTask } from "./routing";
import { type GenerateRequest, type ProviderAdapter, type StreamChunk } from "./types";
import type { ProviderId } from "@/types/domain";

const ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  anthropic: AnthropicAdapter,
  openai: OpenAIAdapter,
  simulated: SimulatedAdapter,
};

/** True when at least one real provider is configured. */
export function liveProviderAvailable(): boolean {
  return AnthropicAdapter.isAvailable() || OpenAIAdapter.isAvailable();
}

export function providerStatus() {
  return {
    anthropic: AnthropicAdapter.isAvailable(),
    openai: OpenAIAdapter.isAvailable(),
    simulated: !liveProviderAvailable(),
  };
}

/**
 * THE AI GATEWAY. All model usage flows through here — UI code never calls a
 * provider. Responsibilities: task routing, provider fallback with bounded
 * retries, usage/cost recording with correlation ids, and failure surfacing.
 *
 * Simulation is used ONLY when no live provider is configured at all. If a
 * configured provider fails, the gateway reports the failure — it never
 * substitutes invented output.
 */
export const aiGateway = {
  async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
    const correlationId = req.correlationId ?? randomUUID();
    const route = routeTask(req.taskType, req.modelPreference);
    const attempts: { provider: ProviderId; model: string }[] = [];

    if (!liveProviderAvailable()) {
      attempts.push({ provider: "simulated", model: "demo-template" });
    } else {
      if (ADAPTERS[route.provider]?.isAvailable()) attempts.push({ provider: route.provider, model: route.model });
      if (route.fallbackProvider && route.fallbackModel && ADAPTERS[route.fallbackProvider]?.isAvailable()) attempts.push({ provider: route.fallbackProvider, model: route.fallbackModel });
      if (!attempts.length) {
        // Executive prefers a provider that is not configured; use any configured one with a sensible model.
        if (AnthropicAdapter.isAvailable()) attempts.push({ provider: "anthropic", model: route.provider === "anthropic" ? route.model : "claude-opus-5-5" });
        else attempts.push({ provider: "openai", model: "gpt-5" });
      }
    }

    const failures: string[] = [];
    for (const [i, attempt] of attempts.entries()) {
      const started = Date.now();
      let emitted = false;
      let usage: { input_tokens: number; output_tokens: number; web_search_requests?: number } = { input_tokens: 0, output_tokens: 0 };
      try {
        const adapter = ADAPTERS[attempt.provider];
        for await (const chunk of adapter.stream({ ...req, model: attempt.model, maxTokens: req.maxTokens ?? route.maxTokens, modelPreference: { ...route, ...req.modelPreference, effort: route.effort } })) {
          if (chunk.type === "text") emitted = true;
          if (chunk.type === "done") {
            usage = chunk.usage ?? usage;
            await recordUsage(req, attempt.provider, chunk.model ?? attempt.model, usage, Date.now() - started, correlationId, true);
          }
          yield chunk;
        }
        return;
      } catch (err) {
        if (req.signal?.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        failures.push(message);
        console.error(`[ai-gateway] ${attempt.provider}/${attempt.model} failed (correlation ${correlationId}):`, message);
        await recordUsage(req, attempt.provider, attempt.model, usage, Date.now() - started, correlationId, false);
        // Never splice a fallback onto a partially-streamed answer. Otherwise always try the
        // next configured provider: a bad key or missing model on one must not block the other.
        if (emitted) break;
        if (i < attempts.length - 1) yield { type: "meta", text: `${message} Switching to ${attempts[i + 1].provider === "openai" ? "OpenAI" : "Claude"}.` };
      }
    }
    yield { type: "error", error: summarizeFailures(failures) };
  },

  /** Non-streaming convenience: collect full text. */
  async generate(req: GenerateRequest): Promise<{ text: string; provider: ProviderId | null; model: string | null; simulated: boolean; error: string | null }> {
    let text = "";
    let provider: ProviderId | null = null;
    let model: string | null = null;
    let simulated = false;
    let error: string | null = null;
    for await (const c of this.stream(req)) {
      if (c.type === "meta" && c.provider) {
        provider = c.provider;
        model = c.model ?? null;
        simulated = Boolean(c.simulated);
      } else if (c.type === "text") text += c.text ?? "";
      else if (c.type === "error") error = c.error ?? "Unknown error";
    }
    return { text, provider, model, simulated, error };
  },
};

/** One readable sentence covering every provider that was tried. */
export function summarizeFailures(failures: string[]): string {
  if (!failures.length) return "No A.I. provider could complete the request.";
  if (failures.length === 1) return failures[0];
  return `No A.I. provider could complete the request. ${failures.join(" ")}`;
}

async function recordUsage(req: GenerateRequest, provider: ProviderId, model: string, usage: { input_tokens: number; output_tokens: number; web_search_requests?: number }, latency: number, correlationId: string, success: boolean) {
  try {
    await db().usage.insert({
      id: newId(),
      organization_id: req.organizationId,
      user_id: req.userId,
      executive_id: req.executiveId,
      provider,
      model,
      request_type: req.taskType,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      estimated_cost_usd: estimateCost(model, usage.input_tokens, usage.output_tokens, usage.web_search_requests ?? 0),
      latency_ms: latency,
      correlation_id: correlationId,
      success,
      created_at: nowIso(),
    });
  } catch (err) {
    console.error("[ai-gateway] failed to record usage", err);
  }
}
