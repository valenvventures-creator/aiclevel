import type { ProviderId } from "@/types/domain";

export type TaskType =
  | "executive_conversation"
  | "session_position"
  | "session_review"
  | "session_synthesis"
  | "session_vote"
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

export class ProviderError extends Error {
  constructor(public readonly provider: ProviderId, message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "ProviderError";
  }
}
