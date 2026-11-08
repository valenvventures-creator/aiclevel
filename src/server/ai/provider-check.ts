import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/**
 * Settings → AI Models → "Test connection". Explains exactly why a provider
 * key does not work, with the next step to take. Never returns the key; it
 * shows only a masked hint (format prefix and last four characters) so the
 * person can compare it with the key in their provider console.
 */
export interface ProviderCheck {
  ok: boolean;
  message: string;
  /** What to do next, in order. */
  steps?: string[];
  /** Masked key hint, e.g. "sk-ant-api03-…x7Qa (108 characters)". */
  keyHint?: string;
}

const CONSOLE = { anthropic: "console.anthropic.com → API Keys", openai: "platform.openai.com → API keys" } as const;
const VAR = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" } as const;

export function maskKey(key: string): string {
  if (!key) return "";
  const dash = key.indexOf("-", key.startsWith("sk-ant-") ? 7 : 3);
  const prefix = key.slice(0, Math.min(dash > 0 ? dash + 1 : 3, 14));
  return `${prefix}…${key.slice(-4)} (${key.length} characters)`;
}

const replaceSteps = (p: "anthropic" | "openai") => [
  `Create a new key at ${CONSOLE[p]} and copy it in full.`,
  `In Netlify: Site configuration → Environment variables → ${VAR[p]} → Edit, paste the new key (nothing else), and save.`,
  "Deploys → Trigger deploy → Deploy site, then test again here.",
];

/** Checks the key's format before calling the provider. */
export function formatProblem(provider: "anthropic" | "openai", key: string): string | null {
  if (!key) return null;
  if (provider === "openai" && key.startsWith("sk-ant-")) return "This is an Anthropic key, not an OpenAI key — it belongs in ANTHROPIC_API_KEY.";
  if (provider === "anthropic" && key.startsWith("sk-ant-admin")) return "This is an Anthropic Admin key. The executives need a regular API key (it starts with sk-ant-api).";
  if (provider === "anthropic" && !key.startsWith("sk-ant-")) return `This does not look like an Anthropic key: it should start with "sk-ant-".${key.startsWith("sk-") ? " It looks like an OpenAI key — it belongs in OPENAI_API_KEY." : ""}`;
  if (provider === "openai" && !key.startsWith("sk-")) return 'This does not look like an OpenAI key: it should start with "sk-".';
  if (key.length < 30) return "The key is too short — it was probably not copied in full.";
  return null;
}

export async function checkProvider(provider: "anthropic" | "openai"): Promise<ProviderCheck> {
  const key = provider === "anthropic" ? env.anthropicApiKey : env.openaiApiKey;
  if (!key) return { ok: false, message: `No key is set. Add ${VAR[provider]} in Netlify (Site configuration → Environment variables), then redeploy.` };
  const keyHint = maskKey(key);
  const format = formatProblem(provider, key);
  if (format) return { ok: false, message: format, steps: replaceSteps(provider), keyHint };
  return provider === "anthropic" ? checkAnthropic(key, keyHint) : checkOpenAI(key, keyHint);
}

async function checkAnthropic(key: string, keyHint: string): Promise<ProviderCheck> {
  try {
    // A one-word request on the fast model: proves the key, the account's access and its credit balance.
    const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 20_000 });
    await client.messages.create({ model: "claude-haiku-5-5", max_tokens: 16, messages: [{ role: "user", content: "ping" }] } as unknown as Parameters<typeof client.messages.create>[0]);
    return { ok: true, message: "Connected. Claude answered a test request.", keyHint };
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? ((err.error as { error?: { message?: string } } | undefined)?.error?.message ?? "") : "";
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, message: "Anthropic rejected this key (401). It is wrong, incomplete, or has been deleted.", steps: replaceSteps("anthropic"), keyHint };
    if (err instanceof Anthropic.PermissionDeniedError) return { ok: false, message: `Anthropic refused access (403)${detail ? `: ${detail}` : "."} The key's workspace may not be allowed to use this model.`, keyHint };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, message: `Anthropic says the account has hit a rate or spend limit (429)${detail ? `: ${detail}` : "."}`, steps: ["Check Plans & Billing and Limits at console.anthropic.com."], keyHint };
    if (err instanceof Anthropic.BadRequestError && /credit|balance|billing/i.test(detail)) return { ok: false, message: "The key works, but the Anthropic account has no credit.", steps: ["Add credit at console.anthropic.com → Plans & Billing, then test again (no redeploy needed)."], keyHint };
    if (err instanceof Anthropic.APIError && typeof err.status === "number") return { ok: false, message: `Anthropic returned an error (${err.status})${detail ? `: ${detail}` : "."}`, keyHint };
    if (err instanceof Anthropic.APIConnectionError) {
      const cause = (err as { cause?: unknown }).cause;
      const why = cause instanceof Error ? cause.message : "";
      return { ok: false, message: `The server could not connect to Anthropic${why ? ` (${why})` : ""}. This is usually temporary — try again in a minute.`, keyHint };
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (/header|invalid character|ByteString/i.test(msg)) return { ok: false, message: "The saved key contains characters that cannot be sent (often a line break or hidden character pasted with it).", steps: replaceSteps("anthropic"), keyHint };
    return { ok: false, message: `The connection test failed: ${msg.slice(0, 200)}`, keyHint };
  }
}

async function checkOpenAI(key: string, keyHint: string): Promise<ProviderCheck> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) });
    if (res.ok) return { ok: true, message: "Connected. OpenAI accepted the key.", keyHint };
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
    // OpenAI's own message masks the key (e.g. "Incorrect API key provided: sk-proj-…abcd").
    const detail = body.error?.message ? ` OpenAI says: “${body.error.message.slice(0, 240)}”` : "";
    if (res.status === 401) return { ok: false, message: `OpenAI rejected this key (401). It is wrong, incomplete, revoked, or its project was deleted.${detail}`, steps: replaceSteps("openai"), keyHint };
    if (res.status === 429) return { ok: false, message: `OpenAI says the account is over its quota or rate limit (429).${detail}`, steps: ["Check Billing and Limits at platform.openai.com."], keyHint };
    return { ok: false, message: `OpenAI returned an error (${res.status}).${detail}`, keyHint };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/header|invalid character|ByteString/i.test(msg)) return { ok: false, message: "The saved key contains characters that cannot be sent (often a line break or hidden character pasted with it).", steps: replaceSteps("openai"), keyHint };
    return { ok: false, message: `The server could not connect to OpenAI (${msg.slice(0, 120)}). This is usually temporary — try again in a minute.`, keyHint };
  }
}
