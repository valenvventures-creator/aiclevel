import "server-only";
import { emailDeliveryConfigured, env } from "@/lib/env";
import type { EmailContent } from "./templates";

/**
 * Transactional email delivery. Provider: Resend (https://resend.com) over its
 * REST API. The adapter boundary keeps the rest of the app provider-neutral.
 */
export type SendResult = { ok: true; id: string | null } | { ok: false; reason: "not_configured" | "rejected" | "unreachable"; detail?: string };

export async function sendEmail(to: string, content: EmailContent): Promise<SendResult> {
  if (!emailDeliveryConfigured()) return { ok: false, reason: "not_configured" };
  try {
    // RESEND_API_URL is only for testing against a local stand-in; it defaults to Resend.
    const res = await fetch(`${process.env.RESEND_API_URL ?? "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.resendApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [to],
        subject: content.subject,
        html: content.html,
        text: content.text,
        ...(env.emailReplyTo ? { reply_to: env.emailReplyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { name?: string; message?: string };
      // Logged for operators; never shown to end users (may mention the sender domain or key status).
      console.error(`[email] Resend rejected the message (${res.status}): ${body.name ?? ""} ${body.message ?? ""}`.trim());
      return { ok: false, reason: "rejected", detail: `${res.status} ${body.message ?? ""}`.trim() };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: body.id ?? null };
  } catch (err) {
    console.error("[email] Resend could not be reached", err);
    return { ok: false, reason: "unreachable" };
  }
}
