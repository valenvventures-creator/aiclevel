import "server-only";
import { env } from "@/lib/env";
import { appOrigin } from "./links";

/**
 * What the running server can see of the email configuration — for
 * administrators. Never returns secret values (only whether the key is present
 * and shaped like a Resend key). EMAIL_FROM is not secret and is shown.
 */
export interface EmailDiagnostics {
  apiKey: "missing" | "present" | "unexpected_format";
  from: { status: "missing" | "ok" | "invalid"; value: string };
  replyTo: string | null;
  linkOrigin: string;
  linkOriginSource: "NEXT_PUBLIC_APP_URL" | "Netlify URL" | "fallback";
  ready: boolean;
}

const ADDRESS = /^(?:[^<>]+<\s*[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+\s*>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/;

export async function emailDiagnostics(): Promise<EmailDiagnostics> {
  const apiKey = !env.resendApiKey ? "missing" : env.resendApiKey.startsWith("re_") ? "present" : "unexpected_format";
  const from = !env.emailFrom ? { status: "missing" as const, value: "" } : { status: ADDRESS.test(env.emailFrom) ? ("ok" as const) : ("invalid" as const), value: env.emailFrom };
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const linkOriginSource = configured && !/localhost|127\.0\.0\.1/.test(configured) ? "NEXT_PUBLIC_APP_URL" : process.env.URL ? "Netlify URL" : "fallback";
  return { apiKey, from, replyTo: env.emailReplyTo || null, linkOrigin: await appOrigin(), linkOriginSource, ready: apiKey !== "missing" && from.status === "ok" };
}
