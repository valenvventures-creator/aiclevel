import type { ProviderId } from "@/types/domain";

export type TaskType =
  | "executive_conversation"
  | "session_position"
  | "session_review"
  | "session_synthesis"
  | "session_vote"
  | "vote_options"
  | "studio_routing"
  | "studio_production"
  | "memory_extraction"
  | "comms_reply"
  | "short_communication";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  organizationId: string;
  userId: string;
  executiveId: string | null;
  executiveRole?: string;
  taskType: TaskType;
  system: string;
  messages: ChatMessage[];
  modelPreference?: { provider: ProviderId; model: string; fallbackProvider?: ProviderId | null; fallbackModel?: string | null; effort?: "low" | "medium" | "high" | "xhigh" | "max" };
  maxTokens?: number;
  promptVersion?: string;
  signal?: AbortSignal;
  correlationId?: string;
}

export interface StreamChunk {
  type: "text" | "meta" | "error" | "done";
  text?: string;
  provider?: ProviderId;
  model?: string;
  simulated?: boolean;
  error?: string;
  usage?: { input_tokens: number; output_tokens: number };
  stopReason?: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  isAvailable(): boolean;
  stream(req: GenerateRequest & { model: string }): AsyncIterable<StreamChunk>;
}

/** Why a provider call failed — drives retry/fallback and the message shown to people. */
export type ProviderErrorKind = "auth" | "permission" | "model_unavailable" | "bad_request" | "rate_limit" | "server" | "network" | "unknown";

export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderId,
    message: string,
    public readonly retryable: boolean,
    public readonly kind: ProviderErrorKind = "unknown",
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

const PROVIDER_LABEL: Record<ProviderId, string> = { anthropic: "Claude (Anthropic)", openai: "OpenAI", simulated: "Simulation" };
const KEY_NAME: Partial<Record<ProviderId, string>> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" };

/** Maps an HTTP status from a provider to a typed, human-readable ProviderError. Never includes key material. */
export function providerErrorFromStatus(provider: ProviderId, status: number, model: string, detail?: string): ProviderError {
  const name = PROVIDER_LABEL[provider];
  const key = KEY_NAME[provider] ?? "the API key";
  if (status === 401) return new ProviderError(provider, `${name} rejected the API key (401). Check ${key} in your hosting environment variables.`, false, "auth");
  if (status === 403) return new ProviderError(provider, `${name} denied access (403). The key in ${key} lacks permission for this request or model.`, false, "permission");
  if (status === 404) return new ProviderError(provider, `${name} could not find model "${model}" (404). Choose a model your account can use in Settings → AI Models.`, false, "model_unavailable");
  if (status === 429) return new ProviderError(provider, `${name} rate limit or quota reached (429).`, true, "rate_limit");
  if (status >= 500) return new ProviderError(provider, `${name} is temporarily unavailable (${status}).`, true, "server");
  return new ProviderError(provider, `${name} rejected the request (${status})${detail ? `: ${detail}` : ""}.`, false, "bad_request");
}
