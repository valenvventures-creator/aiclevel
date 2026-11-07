import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Centralized server environment access. Never import from client components.
 * Absence of Supabase configuration puts the platform in DEMO MODE.
 */
const g = globalThis as unknown as { __taEphemeralSecret?: string };

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  isProduction: process.env.NODE_ENV === "production",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export type DataMode = "supabase" | "demo";
export function dataMode(): DataMode {
  return isSupabaseConfigured() ? "supabase" : "demo";
}

/** Session-signing secret. Falls back to an ephemeral per-process secret (sessions reset on restart). */
export function sessionSecret(): Uint8Array {
  let s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    g.__taEphemeralSecret ??= randomBytes(48).toString("hex");
    s = g.__taEphemeralSecret;
  }
  return new TextEncoder().encode(s);
}
