"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { dataMode, env } from "@/lib/env";
import { supabaseServer } from "@/server/db/supabase";
import { audit } from "@/server/audit";
import { ensureDemoSeeded, DEMO_CREDENTIALS } from "@/server/db/demo-seed";
import { demoIdentity } from "./identity";
import { rateLimit } from "./rate-limit";
import { createDemoSession, destroySession, getCurrentUser } from "./session";
import { forgotSchema, loginSchema, resetSchema, safeNext, signupSchema } from "./schemas";
import { listMembershipsForUser } from "@/server/organizations/service";

export interface FormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  /** Demo mode only: emails are not delivered, so the link is shown on screen. */
  devLink?: string;
  values?: Record<string, string>;
}

const GENERIC_LOGIN_ERROR = "That email and password combination was not recognised.";

async function clientKey(scope: string, extra = "") {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${scope}:${ip}:${extra}`;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

function formValues(fd: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));
}

async function postAuthRedirect(userId: string, next?: string): Promise<never> {
  const memberships = await listMembershipsForUser(userId);
  const user = await getCurrentUser();
  if (!memberships.length || (user && !user.onboarding_completed && memberships[0]?.member.role === "OWNER" && !memberships[0].organization.is_demo)) {
    redirect("/onboarding");
  }
  redirect(safeNext(next));
}

/* -------------------------------- SIGN UP -------------------------------- */

export async function signupAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd, ["first_name", "last_name", "email", "invite_token"]);
  const parsed = signupSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };
  const rl = rateLimit(await clientKey("signup"), 5, 60 * 60_000);
  if (!rl.ok) return { error: "Too many sign-up attempts. Please try again later.", values };
  const d = parsed.data;

  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.signUp({
      email: d.email,
      password: d.password,
      options: { data: { first_name: d.first_name, last_name: d.last_name }, emailRedirectTo: `${env.appUrl}/verify-email` },
    });
    if (error) return { error: "We couldn't create that account. If you already have one, log in instead.", values };
    await audit(null, data.user?.id ?? null, "auth.signup", "user", data.user?.id ?? null, {});
    if (!data.session) return { ok: true, message: "Check your inbox to verify your email, then log in to continue onboarding." };
  } else {
    await ensureDemoSeeded();
    if (demoIdentity.findByEmail(d.email)) return { error: "We couldn't create that account. If you already have one, log in instead.", values };
    const user = await demoIdentity.createUser({ email: d.email, password: d.password, first_name: d.first_name, last_name: d.last_name });
    demoIdentity.issueToken(user.id, "VERIFY_EMAIL", 24 * 60 * 60_000);
    await createDemoSession(user.id, false);
    await audit(null, user.id, "auth.signup", "user", user.id, {});
  }
  redirect(d.invite_token ? `/invite/${encodeURIComponent(d.invite_token)}` : "/onboarding");
}

/* --------------------------------- LOG IN -------------------------------- */

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd, ["email", "next"]);
  const parsed = loginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };
  const { email, password, remember, next } = parsed.data;
  const rlIp = rateLimit(await clientKey("login"), 20, 15 * 60_000);
  const rlAcct = rateLimit(`login-acct:${email}`, 8, 15 * 60_000);
  if (!rlIp.ok || !rlAcct.ok) return { error: "Too many attempts. Please wait a few minutes and try again.", values };

  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      await audit(null, null, "auth.login_failed", "user", null, { email_hash: email.length });
      return { error: GENERIC_LOGIN_ERROR, values };
    }
    await audit(null, data.user.id, "auth.login", "user", data.user.id, {});
    return postAuthRedirect(data.user.id, next);
  }

  await ensureDemoSeeded();
  const res = await demoIdentity.checkPassword(email, password);
  if (!res.ok) {
    await audit(null, null, "auth.login_failed", "user", null, {});
    return { error: res.reason === "LOCKED" ? "This account is temporarily locked after repeated failed attempts. Try again in 15 minutes or reset your password." : GENERIC_LOGIN_ERROR, values };
  }
  await createDemoSession(res.user.id, remember === "on");
  await audit(null, res.user.id, "auth.login", "user", res.user.id, {});
  return postAuthRedirect(res.user.id, next);
}

/** One-click entry into the clearly-labelled demo organization (demo mode only). */
export async function demoLoginAction(): Promise<void> {
  if (dataMode() !== "demo") redirect("/login");
  await ensureDemoSeeded();
  const res = await demoIdentity.checkPassword(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
  if (!res.ok) redirect("/login");
  await createDemoSession(res.user.id, false);
  redirect("/hq");
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit(null, user.id, "auth.logout", "user", user.id, {});
  redirect("/login");
}

/* ---------------------------- PASSWORD RESET ----------------------------- */

const RESET_MESSAGE = "If an account exists for that email, a secure reset link is on its way. It expires in 30 minutes.";

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const rl = rateLimit(await clientKey("forgot", parsed.data.email), 3, 60 * 60_000);
  if (!rl.ok) return { ok: true, message: RESET_MESSAGE }; // do not reveal throttling per account

  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    await sb.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${env.appUrl}/reset-password` });
    return { ok: true, message: RESET_MESSAGE };
  }
  await ensureDemoSeeded();
  const u = demoIdentity.findByEmail(parsed.data.email);
  if (!u) return { ok: true, message: RESET_MESSAGE };
  const token = demoIdentity.issueToken(u.profile.id, "RESET_PASSWORD", 30 * 60_000);
  return { ok: true, message: RESET_MESSAGE, devLink: `/reset-password?token=${token}` };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  if (dataMode() === "supabase") {
    // Supabase delivers a recovery session via the email link; update the password on that session.
    const password = String(fd.get("password") ?? "");
    const parsed = resetSchema.safeParse({ token: "supabase-recovery-session", password, confirm_password: fd.get("confirm_password") });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.updateUser({ password });
    if (error) return { error: "This reset link is invalid or has expired. Request a new one." };
    await sb.auth.signOut({ scope: "others" });
    await audit(null, data.user?.id ?? null, "auth.password_reset", "user", data.user?.id ?? null, {});
    redirect("/hq");
  }
  const parsed = resetSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const userId = demoIdentity.consumeToken(parsed.data.token, "RESET_PASSWORD");
  if (!userId) return { error: "This reset link is invalid or has expired. Request a new one." };
  await demoIdentity.setPassword(userId, parsed.data.password, true); // revokes existing sessions
  await audit(null, userId, "auth.password_reset", "user", userId, {});
  redirect("/login?reset=1");
}

/* ---------------------------- EMAIL VERIFICATION ------------------------- */

export async function resendVerificationAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.email_verified) return { ok: true, message: "Your email is already verified." };
  const rl = rateLimit(`verify:${user.id}`, 3, 60 * 60_000);
  if (!rl.ok) return { error: "Please wait before requesting another verification email." };
  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    await sb.auth.resend({ type: "signup", email: user.email, options: { emailRedirectTo: `${env.appUrl}/verify-email` } });
    return { ok: true, message: "Verification email sent." };
  }
  const token = demoIdentity.issueToken(user.id, "VERIFY_EMAIL", 24 * 60 * 60_000);
  return { ok: true, message: "Verification email sent.", devLink: `/verify-email?token=${token}` };
}

/** Token confirmation is a POST (button), so link scanners and prefetchers cannot consume it. */
export async function verifyEmailAction(_: FormState, fd: FormData): Promise<FormState> {
  if (dataMode() === "supabase") return { ok: true, message: "Your email has been verified." }; // Supabase verifies via its own link
  const token = String(fd.get("token") ?? "");
  const userId = token ? demoIdentity.consumeToken(token, "VERIFY_EMAIL") : null;
  if (!userId) return { error: "This verification link is invalid or has expired. Request a new one below." };
  demoIdentity.updateProfile(userId, { email_verified: true });
  return { ok: true, message: "Your email has been verified." };
}
