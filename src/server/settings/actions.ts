"use server";

import { checkProvider, type ProviderCheck } from "@/server/ai/provider-check";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dataMode } from "@/lib/env";
import { authorize, getConstitution, requireContext, updateOrganizationRecord } from "@/server/organizations/service";
import { createInvitation } from "@/server/organizations/invitations";
import { sendInvitationEmail } from "@/server/email/flows";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { assignableRoles } from "@/server/auth/permissions";
import { demoIdentity } from "@/server/auth/identity";
import { passwordSchema } from "@/server/auth/schemas";
import { supabaseServer } from "@/server/db/supabase";
import { db, newId, nowIso } from "@/server/db/store";
import { DEMO_USER_ID } from "@/server/db/demo-seed";
import { audit } from "@/server/audit";
import { TOOL_REGISTRY } from "@/config/tools/registry";
import { MEMORY_CATEGORIES, ROLES, type AIExecutiveModelConfig, type MemoryCategory, type OrganizationConstitution, type Role } from "@/types/domain";

export interface SettingsState {
  ok?: boolean;
  error?: string;
  message?: string;
  devLink?: string;
  /** Invitation link the inviting admin can share by hand when email can't be sent. */
  shareLink?: string;
}

const fail = (e: unknown): SettingsState => ({ error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Invalid input.") : e instanceof Error ? e.message : "Something went wrong." });

export async function updateProfileAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    const ctx = await requireContext();
    const p = z.object({ first_name: z.string().trim().min(1).max(60), last_name: z.string().trim().min(1).max(60), display_name: z.string().trim().max(80).optional(), timezone: z.string().trim().max(60) }).parse(Object.fromEntries(fd));
    try { new Intl.DateTimeFormat("en-US", { timeZone: p.timezone }); } catch { return { error: "Unknown timezone." }; }
    if (dataMode() === "supabase") {
      const sb = await supabaseServer();
      await sb.from("profiles").update({ ...p, display_name: p.display_name || null }).eq("id", ctx.user.id);
    } else await demoIdentity.updateProfile(ctx.user.id, { ...p, display_name: p.display_name || null });
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile saved." };
  } catch (e) { return fail(e); }
}

export async function changePasswordAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    const ctx = await requireContext();
    const p = z.object({ current: z.string().min(1), password: passwordSchema, confirm: z.string() }).refine((d) => d.password === d.confirm, { message: "Passwords do not match." }).parse(Object.fromEntries(fd));
    if (dataMode() === "supabase") {
      const sb = await supabaseServer();
      const { error: e1 } = await sb.auth.signInWithPassword({ email: ctx.user.email, password: p.current });
      if (e1) return { error: "Your current password is incorrect." };
      const { error } = await sb.auth.updateUser({ password: p.password });
      if (error) return { error: "Could not update password." };
    } else {
      if (ctx.user.id === DEMO_USER_ID) return { error: "The shared demo account's password cannot be changed. Create your own account to set a password." };
      const ok = await demoIdentity.checkPassword(ctx.user.email, p.current);
      if (!ok.ok) return { error: "Your current password is incorrect." };
      await demoIdentity.setPassword(ctx.user.id, p.password, false);
    }
    await audit(ctx.organization.id, ctx.user.id, "auth.password_change", "user", ctx.user.id, {});
    return { ok: true, message: "Password updated." };
  } catch (e) { return fail(e); }
}

export async function revokeOtherSessionsAction() {
  const ctx = await requireContext();
  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    await sb.auth.signOut({ scope: "others" });
  } else if (ctx.user.id !== DEMO_USER_ID) {
    // The shared demo account is used by many visitors at once; never sign them all out.
    await demoIdentity.revokeSessions(ctx.user.id);
    // Re-issue the current session so this device stays signed in.
    const { createDemoSession } = await import("@/server/auth/session");
    await createDemoSession(ctx.user.id, false);
  }
  revalidatePath("/settings/security");
}

export async function updateOrganizationAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    const ctx = await authorize("org.update");
    const p = z.object({ name: z.string().trim().min(2).max(120), industry: z.string().trim().max(120).optional() }).parse(Object.fromEntries(fd));
    await updateOrganizationRecord(ctx.organization.id, { name: p.name, industry: p.industry || null });
    await audit(ctx.organization.id, ctx.user.id, "org.update", "organization", ctx.organization.id, {});
    revalidatePath("/", "layout");
    return { ok: true, message: "Organization updated." };
  } catch (e) { return fail(e); }
}

const CONSTITUTION_FIELDS = ["mission", "vision", "values", "business_model", "leadership_philosophy", "strategic_priorities", "current_priorities", "brand_voice", "primary_audiences", "financial_objectives", "technology_objectives", "impact_objectives", "key_relationships", "important_restrictions", "decision_principles", "operating_philosophy"] as const;

export async function updateConstitutionAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    const ctx = await authorize("org.update");
    const c = await getConstitution(ctx.organization.id);
    const patch: Partial<OrganizationConstitution> = { updated_at: nowIso() };
    for (const f of CONSTITUTION_FIELDS) {
      const v = fd.get(f);
      if (typeof v === "string") patch[f] = v.trim().slice(0, 4000);
    }
    const rt = fd.get("risk_tolerance");
    if (rt === "CONSERVATIVE" || rt === "BALANCED" || rt === "AGGRESSIVE") patch.risk_tolerance = rt;
    await db().constitutions.update(ctx.organization.id, c.id, patch);
    await audit(ctx.organization.id, ctx.user.id, "constitution.update", "organization_constitution", c.id, {});
    return { ok: true, message: "Organization Constitution saved. All seven executives will use it from their next request." };
  } catch (e) { return fail(e); }
}

export async function inviteMemberAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    const ctx = await authorize("team.invite");
    const p = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email."), role: z.enum(ROLES) }).parse(Object.fromEntries(fd));
    const { token } = await createInvitation({ organization: ctx.organization, actor: ctx.user, actorRole: ctx.role, email: p.email, role: p.role });
    revalidatePath("/settings/team");
    const sent = await sendInvitationEmail({ email: p.email, token, inviterName: `${ctx.user.first_name} ${ctx.user.last_name}`.trim() || "A colleague", organizationName: ctx.organization.name, role: p.role });
    if (sent.delivery.ok) return { ok: true, message: `Invitation emailed to ${p.email}. It expires in 7 days.` };
    return {
      ok: true,
      message: `Invitation created for ${p.email}, but ${sent.delivery.reason === "not_configured" ? "email delivery isn't set up yet" : "the email couldn't be sent"}. Share this link with them directly — it expires in 7 days and only works for ${p.email}.`,
      shareLink: sent.shareLink,
    };
  } catch (e) { return fail(e); }
}

export async function changeRoleAction(fd: FormData) {
  const ctx = await authorize("team.change_role");
  const memberId = String(fd.get("member_id"));
  const role = String(fd.get("role")) as Role;
  const m = await db().members.get(ctx.organization.id, memberId);
  if (!m || m.role === "OWNER" || m.user_id === ctx.user.id) return; // protected owner actions
  if (!assignableRoles(ctx.role).includes(role)) return;
  await db().members.update(ctx.organization.id, memberId, { role });
  await audit(ctx.organization.id, ctx.user.id, "team.role_change", "organization_member", memberId, { role });
  revalidatePath("/settings/team");
}

export async function removeMemberAction(fd: FormData) {
  const ctx = await authorize("team.remove");
  const memberId = String(fd.get("member_id"));
  const m = await db().members.get(ctx.organization.id, memberId);
  if (!m || m.role === "OWNER" || m.user_id === ctx.user.id) return;
  if (ctx.role === "ADMIN" && m.role === "ADMIN") return;
  // Shared organization data is never deleted when a member leaves.
  await db().members.update(ctx.organization.id, memberId, { status: "SUSPENDED" });
  await audit(ctx.organization.id, ctx.user.id, "team.remove", "organization_member", memberId, {});
  revalidatePath("/settings/team");
}

const ExecPatch = z.object({
  executive_id: z.string().uuid(),
  display_name: z.string().trim().max(80).optional(),
  title: z.string().trim().min(2).max(80),
  functional_mandate: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600),
  avatar_url: z.string().trim().url().max(500).or(z.literal("")),
  north_star: z.string().max(400), core_belief: z.string().max(400), leadership_promise: z.string().max(400), biography: z.string().max(2000),
  personality: z.string().max(400), communication_style: z.string().max(600), decision_style: z.string().max(600), primary_question: z.string().max(300),
  system_instructions: z.string().max(6000), reasoning_guidelines: z.string().max(2000), output_preferences: z.string().max(1000), risk_constraints: z.string().max(1000),
  primary_provider: z.enum(["anthropic", "openai"]), primary_model: z.string().trim().min(2).max(80),
  fallback_provider: z.enum(["anthropic", "openai", ""]), fallback_model: z.string().trim().max(80),
  effort: z.enum(["low", "medium", "high", "xhigh", "max"]), token_budget: z.coerce.number().int().min(1000).max(128000),
});

/** One skill per line: "Name — description" (or "Name: description"). At most 20. */
function parseSkills(text: string): { name: string; description: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean)
    .slice(0, 20)
    .map((l) => {
      const [name, ...rest] = l.split(/\s+[—–-]\s+|:\s+/);
      return { name: name.trim().slice(0, 80), description: rest.join(" — ").trim().slice(0, 300) };
    })
    .filter((s) => s.name);
}

export async function updateExecutiveConfigAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    const ctx = await authorize("executives.configure");
    const p = ExecPatch.parse(Object.fromEntries(fd));
    const tools = fd.getAll("tools").map(String).filter((t) => t in TOOL_REGISTRY);
    // Memory areas: "all", or the chosen categories (at least one).
    const areas = fd.getAll("memory_categories").map(String);
    const memory_categories: AIExecutiveModelConfig["memory_categories"] | undefined = fd.has("memory_scope")
      ? fd.get("memory_scope") === "ALL"
        ? "ALL"
        : (MEMORY_CATEGORIES.filter((c) => areas.includes(c)) as MemoryCategory[])
      : undefined;
    if (Array.isArray(memory_categories) && memory_categories.length === 0) return { error: "Choose at least one memory area, or allow all areas." };
    const skills = fd.has("skills") ? parseSkills(String(fd.get("skills"))) : null;
    const exec = await AIExecutiveRegistry.getExecutive(ctx.organization.id, p.executive_id);
    if (!exec) return { error: "Executive not found." };
    await AIExecutiveRegistry.updateExecutive(ctx.organization.id, ctx.user.id, exec.id, {
      executive: { display_name: p.display_name || null, title: p.title, functional_mandate: p.functional_mandate, description: p.description, avatar_url: p.avatar_url || null },
      persona: { north_star: p.north_star, core_belief: p.core_belief, leadership_promise: p.leadership_promise, biography: p.biography, personality: p.personality, communication_style: p.communication_style, decision_style: p.decision_style, primary_question: p.primary_question, system_instructions: p.system_instructions, reasoning_guidelines: p.reasoning_guidelines, output_preferences: p.output_preferences, risk_constraints: p.risk_constraints },
      model: { primary_provider: p.primary_provider, primary_model: p.primary_model, fallback_provider: p.fallback_provider || null, fallback_model: p.fallback_model || null, effort: p.effort, token_budget: p.token_budget, tool_permissions: tools, ...(memory_categories ? { memory_categories } : {}) },
    });
    if (skills) await AIExecutiveRegistry.replaceSkills(ctx.organization.id, ctx.user.id, exec.id, skills);
    revalidatePath("/executives", "layout");
    return { ok: true, message: `${p.title} updated.` };
  } catch (e) { return fail(e); }
}

/** Turns web research on or off for every executive in one step (Settings → Tools). */
export async function setWebResearchForAllAction(fd: FormData) {
  const ctx = await authorize("executives.configure");
  const enable = fd.get("enabled") === "true";
  const orgId = ctx.organization.id;
  const configs = await db().modelConfigs.list(orgId);
  for (const c of configs) {
    const has = c.tool_permissions.includes("web_research");
    if (enable === has) continue;
    const tool_permissions = enable ? [...c.tool_permissions, "web_research"] : c.tool_permissions.filter((t) => t !== "web_research");
    await db().modelConfigs.update(orgId, c.id, { tool_permissions });
  }
  await audit(orgId, ctx.user.id, "executive.config_change", "ai_executive", null, { web_research: enable ? "all_on" : "all_off" });
  revalidatePath("/settings/tools");
  revalidatePath("/executives", "layout");
}

export async function addCeoIntelligenceAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    const ctx = await authorize("ceo_intelligence.manage");
    const p = z.object({ kind: z.enum(["PRINCIPLE", "DECISION", "WRITING", "SPEECH", "INTERVIEW", "PREFERENCE", "HISTORY"]), title: z.string().trim().min(2).max(160), content: z.string().trim().min(2).max(8000) }).parse(Object.fromEntries(fd));
    const id = newId();
    await db().ceoIntelligence.insert({ id, organization_id: ctx.organization.id, owner_user_id: ctx.user.id, ...p, included: true, created_at: nowIso() });
    await audit(ctx.organization.id, ctx.user.id, "ceo_intelligence.change", "human_ceo_intelligence", id, { op: "add" });
    revalidatePath("/settings/ceo-intelligence");
    return { ok: true, message: "Added to your leadership intelligence profile." };
  } catch (e) { return fail(e); }
}

export async function ceoIntelligenceOpAction(fd: FormData) {
  const ctx = await authorize("ceo_intelligence.manage");
  const id = String(fd.get("id"));
  const op = String(fd.get("op"));
  const row = await db().ceoIntelligence.get(ctx.organization.id, id);
  if (!row) return;
  if (op === "toggle") await db().ceoIntelligence.update(ctx.organization.id, id, { included: !row.included });
  if (op === "delete") await db().ceoIntelligence.remove(ctx.organization.id, id);
  await audit(ctx.organization.id, ctx.user.id, "ceo_intelligence.change", "human_ceo_intelligence", id, { op });
  revalidatePath("/settings/ceo-intelligence");
}

/** Provider connectivity test — server-side only; never echoes the key. */
export async function testProviderAction(provider: "anthropic" | "openai"): Promise<ProviderCheck> {
  await authorize("models.configure");
  return checkProvider(provider);
}

/** Sends a test email to the signed-in administrator and reports the provider's answer (admins only). */
export async function sendTestEmailAction(): Promise<SettingsState> {
  try {
    const ctx = await authorize("integrations.manage");
    const { sendEmail } = await import("@/server/email/mailer");
    const { testEmail } = await import("@/server/email/templates");
    const { absoluteUrl, appOrigin } = await import("@/server/email/links");
    const r = await sendEmail(ctx.user.email, testEmail({ firstName: ctx.user.first_name, url: await absoluteUrl("/hq"), origin: await appOrigin() }));
    if (r.ok) return { ok: true, message: `Test email sent to ${ctx.user.email}. It usually arrives within a minute — check spam if it doesn't.` };
    if (r.reason === "not_configured") return { error: "The server doesn't see RESEND_API_KEY and EMAIL_FROM yet. See the checklist below." };
    if (r.reason === "unreachable") return { error: "The server couldn't reach Resend. Try again in a minute." };
    return { error: `Resend refused the message: ${r.detail ?? "unknown reason"}. This usually means the sending domain in EMAIL_FROM isn't verified in Resend, or the API key is wrong.` };
  } catch (e) {
    return fail(e);
  }
}
