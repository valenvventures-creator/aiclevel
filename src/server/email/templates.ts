/**
 * Branded transactional email templates (HTML + plain text).
 * Table-based layout and inline styles for broad email-client support.
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(opts: { preheader: string; heading: string; body: string[]; cta: { label: string; url: string }; footnote: string; origin: string }): string {
  const paras = opts.body.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a3d46;">${esc(p)}</p>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f2ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<span style="display:none!important;opacity:0;color:transparent;max-height:0;overflow:hidden;">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e1d3;">
<tr><td style="background:#07080b;padding:22px 32px;">
<img src="${esc(opts.origin)}/brand/crest-256.png" width="52" height="30" alt="Thought Authorities" style="display:inline-block;vertical-align:middle;border:0;">
<span style="display:inline-block;vertical-align:middle;margin-left:12px;font-size:12px;letter-spacing:3px;font-weight:700;color:#efba11;">THOUGHT AUTHORITIES</span>
<div style="margin:4px 0 0 64px;font-size:10px;letter-spacing:3px;color:#a7a399;">A.I. C-SUITE</div>
</td></tr>
<tr><td style="padding:36px 32px 12px;">
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#12141c;">${esc(opts.heading)}</h1>
${paras}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:999px;background:#efba11;">
<a href="${esc(opts.cta.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#07080b;text-decoration:none;border-radius:999px;">${esc(opts.cta.label)}</a>
</td></tr></table>
<p style="margin:0 0 6px;font-size:12px;color:#6b6b73;">Or paste this link into your browser:</p>
<p style="margin:0 0 24px;font-size:12px;word-break:break-all;"><a href="${esc(opts.cta.url)}" style="color:#9a7408;">${esc(opts.cta.url)}</a></p>
<p style="margin:0 0 28px;font-size:12px;line-height:1.6;color:#6b6b73;">${esc(opts.footnote)}</p>
</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #eee9dc;font-size:11px;line-height:1.6;color:#8a8a90;">
Thought Authorities · A.I. C-Suite — Seven Executives. One Organization. Shared Intelligence.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function text(heading: string, body: string[], cta: { label: string; url: string }, footnote: string): string {
  return [`THOUGHT AUTHORITIES · A.I. C-SUITE`, ``, heading, ``, ...body.flatMap((p) => [p, ""]), `${cta.label}: ${cta.url}`, ``, footnote].join("\n");
}

export function verificationEmail(p: { firstName: string; url: string; origin: string }): EmailContent {
  const heading = "Verify your email address";
  const body = [`Hi ${p.firstName || "there"},`, "Confirm this email address to finish setting up your A.I. C-Suite. Verifying unlocks inviting team members to your organization."];
  const cta = { label: "Verify email address", url: p.url };
  const foot = "This link expires in 24 hours and can be used once. If you didn't create a Thought Authorities account, you can ignore this email.";
  return { subject: "Verify your email — Thought Authorities A.I. C-Suite", html: layout({ preheader: "Confirm your email to finish setting up your A.I. C-Suite.", heading, body, cta, footnote: foot, origin: p.origin }), text: text(heading, body, cta, foot) };
}

export function passwordResetEmail(p: { firstName: string; url: string; origin: string }): EmailContent {
  const heading = "Reset your password";
  const body = [`Hi ${p.firstName || "there"},`, "We received a request to reset the password for your Thought Authorities account. Choose a new password using the button below. Resetting signs you out on your other devices."];
  const cta = { label: "Choose a new password", url: p.url };
  const foot = "This link expires in 30 minutes and can be used once. If you didn't ask to reset your password, ignore this email — your password stays the same.";
  return { subject: "Reset your password — Thought Authorities A.I. C-Suite", html: layout({ preheader: "Choose a new password for your A.I. C-Suite account.", heading, body, cta, footnote: foot, origin: p.origin }), text: text(heading, body, cta, foot) };
}

export function invitationEmail(p: { inviterName: string; organizationName: string; role: string; url: string; origin: string }): EmailContent {
  const heading = `Join ${p.organizationName} on the A.I. C-Suite`;
  const body = [`${p.inviterName} invited you to join ${p.organizationName} as ${p.role.charAt(0) + p.role.slice(1).toLowerCase()}.`, "The A.I. C-Suite gives your organization seven A.I. executives — CEO to Chief Impact Officer — who share one organizational memory and work alongside your leadership team."];
  const cta = { label: "Accept invitation", url: p.url };
  const foot = "This invitation expires in 7 days and can only be accepted with this email address. If you weren't expecting it, you can ignore this email.";
  return { subject: `${p.inviterName} invited you to ${p.organizationName} — A.I. C-Suite`, html: layout({ preheader: `Join ${p.organizationName} on Thought Authorities A.I. C-Suite.`, heading, body, cta, footnote: foot, origin: p.origin }), text: text(heading, body, cta, foot) };
}
