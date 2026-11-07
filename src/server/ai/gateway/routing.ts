import type { ProviderId } from "@/types/domain";
import type { TaskType } from "./types";

/**
 * Task-appropriate model routing ("Route to the right executive" under the hood).
 * Executive conversations and sessions use the executive's configured model;
 * light-weight utility tasks use a fast, lower-cost model. Centrally
 * configurable — change here or override per executive in Settings → AI Models.
 */
export interface RouteDecision {
  provider: ProviderId;
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  fallbackProvider: ProviderId | null;
  fallbackModel: string | null;
  maxTokens: number;
}

export const UTILITY_ROUTE: RouteDecision = { provider: "anthropic", model: "claude-haiku-5-5", effort: "low", fallbackProvider: "openai", fallbackModel: "gpt-5-mini", maxTokens: 2000 };

const UTILITY_TASKS: TaskType[] = ["studio_routing", "memory_extraction", "short_communication", "vote_options"];

export const TASK_MAX_TOKENS: Record<TaskType, number> = {
  executive_conversation: 16000,
  session_position: 6000,
  session_review: 8000,
  session_synthesis: 12000,
  session_vote: 3000,
  vote_options: 600,
  studio_routing: 500,
  studio_production: 32000,
  memory_extraction: 4000,
  comms_reply: 6000,
  short_communication: 2000,
};

export function routeTask(
  taskType: TaskType,
  pref?: { provider: ProviderId; model: string; fallbackProvider?: ProviderId | null; fallbackModel?: string | null; effort?: RouteDecision["effort"] },
): RouteDecision {
  if (UTILITY_TASKS.includes(taskType) || !pref) return { ...UTILITY_ROUTE, maxTokens: TASK_MAX_TOKENS[taskType] };
  return {
    provider: pref.provider,
    model: pref.model,
    effort: taskType === "session_vote" ? "medium" : (pref.effort ?? "high"),
    fallbackProvider: pref.fallbackProvider ?? null,
    fallbackModel: pref.fallbackModel ?? null,
    maxTokens: TASK_MAX_TOKENS[taskType],
  };
}

/** Indicative USD per 1M tokens for usage dashboards (input, output). */
export const PRICE_TABLE: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export function estimateCost(model: string, input: number, output: number): number {
  const p = PRICE_TABLE[model];
  if (!p) return 0;
  return (input * p[0] + output * p[1]) / 1_000_000;
}
