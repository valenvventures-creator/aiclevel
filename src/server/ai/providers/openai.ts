import "server-only";
import { env } from "@/lib/env";
import { ProviderError, providerErrorFromStatus, type GenerateRequest, type ProviderAdapter, type StreamChunk } from "../gateway/types";

/**
 * OpenAI adapter (fallback reasoning, future image/audio). Uses the Chat
 * Completions streaming endpoint over fetch to avoid coupling the core to a
 * second SDK. Server-side only.
 */
export const OpenAIAdapter: ProviderAdapter = {
  id: "openai",
  isAvailable: () => Boolean(env.openaiApiKey),
  async *stream(req: GenerateRequest & { model: string }): AsyncIterable<StreamChunk> {
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: req.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${env.openaiApiKey}` },
      body: JSON.stringify({
        model: req.model,
        stream: true,
        stream_options: { include_usage: true },
        max_completion_tokens: req.maxTokens ?? 8000,
        messages: [{ role: "system", content: req.system }, ...req.messages],
      }),
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") throw err;
      throw new ProviderError("openai", "OpenAI could not be reached from the server.", true, "network");
    }
    if (!res.ok || !res.body) {
      // OpenAI error bodies can echo part of the key on 401, so only the error code/type is surfaced.
      let detail: string | undefined;
      try {
        const j = (await res.json()) as { error?: { code?: string; type?: string } };
        detail = j.error?.code ?? j.error?.type ?? undefined;
      } catch {
        /* non-JSON body */
      }
      throw providerErrorFromStatus("openai", res.status, req.model, detail);
    }
    yield { type: "meta", provider: "openai", model: req.model, simulated: false };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let usage: StreamChunk["usage"];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith("data:")) continue;
        const data = l.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; usage?: { prompt_tokens: number; completion_tokens: number } };
          const t = json.choices?.[0]?.delta?.content;
          if (t) yield { type: "text", text: t };
          if (json.usage) usage = { input_tokens: json.usage.prompt_tokens, output_tokens: json.usage.completion_tokens };
        } catch {
          /* ignore keep-alive fragments */
        }
      }
    }
    yield { type: "done", usage, model: req.model };
  },
};
