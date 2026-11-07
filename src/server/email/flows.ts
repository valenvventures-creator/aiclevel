import "server-only";
import { env } from "@/lib/env";
import { demoIdentity } from "@/server/auth/identity";
import { absoluteUrl, appOrigin } from "./links";
import { sendEmail, type SendResult } from "./mailer";
import { invitationEmail, passwordResetEmail, verificationEmail } from "./templates";

/**
 * Account emails for the built-in identity store (Supabase Auth sends its own).
 *
 * `localLink` is returned ONLY outside production when no email provider is
 * configured, so local development still works. In production a secure link is
 * never shown on screen — showing a reset link to whoever typed an email address
 * would let anyone take over any account.
 */
export interface FlowResult {
  delivery: SendResult;
  localLink?: string;
}

const devOnly = (path: string, delivery: SendResult) => (!delivery.ok && delivery.reason === "not_configured" && !env.isProduction ? path : undefined);

export async function sendVerificationEmail(user: { id: string; email: string; first_name: string }): Promise<FlowResult> {
  const token = await demoIdentity.issueToken(user.id, "VERIFY_EMAIL", 24 * 60 * 60_000);
  const path = `/verify-email?token=${encodeURIComponent(token)}`;
  const delivery = await sendEmail(user.email, verificationEmail({ firstName: user.first_name, url: await absoluteUrl(path), origin: await appOrigin() }));
  return { delivery, localLink: devOnly(path, delivery) };
}

export async function sendPasswordResetEmail(user: { id: string; email: string; first_name: string }): Promise<FlowResult> {
  const token = await demoIdentity.issueToken(user.id, "RESET_PASSWORD", 30 * 60_000);
  const path = `/reset-password?token=${encodeURIComponent(token)}`;
  const delivery = await sendEmail(user.email, passwordResetEmail({ firstName: user.first_name, url: await absoluteUrl(path), origin: await appOrigin() }));
  return { delivery, localLink: devOnly(path, delivery) };
}

/** Invitations: the inviting admin may always receive the link to share by hand if email can't be sent. */
export async function sendInvitationEmail(p: { email: string; token: string; inviterName: string; organizationName: string; role: string }): Promise<{ delivery: SendResult; shareLink?: string }> {
  const url = await absoluteUrl(`/invite/${encodeURIComponent(p.token)}`);
  const delivery = await sendEmail(p.email, invitationEmail({ inviterName: p.inviterName, organizationName: p.organizationName, role: p.role, url, origin: await appOrigin() }));
  return { delivery, shareLink: delivery.ok ? undefined : url };
}

export const EMAIL_NOT_CONFIGURED =
  "Email delivery isn't set up on this site yet, so no email could be sent. An administrator needs to add RESEND_API_KEY and EMAIL_FROM to the site's environment variables.";
export const EMAIL_FAILED = "We couldn't send the email right now. Please try again in a few minutes.";
