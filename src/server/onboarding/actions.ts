"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dataMode } from "@/lib/env";
import { supabaseServer } from "@/server/db/supabase";
import { demoIdentity } from "@/server/auth/identity";
import { ORG_COOKIE, requireUser } from "@/server/auth/session";
import { db, newId, nowIso } from "@/server/db/store";
import { createOrganization, getConstitution, listMembershipsForUser } from "@/server/organizations/service";
import { lexicalEmbedding } from "@/server/memory/embeddings";
import { notify } from "@/server/notifications";
import { audit } from "@/server/audit";
import type { MemoryCategory, OrganizationConstitution, UserProfile } from "@/types/domain";

export interface OnboardingState {
  ok?: boolean;
  error?: string;
  step?: number;
}

async function updateProfile(userId: string, patch: Partial<UserProfile>) {
  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    await sb.from("profiles").update(patch).eq("id", userId);
  } else await demoIdentity.updateProfile(userId, patch);
}

/** Owner's active onboarding organization (created at step 2). */
async function ownedOrg(userId: string) {
  const ms = await listMembershipsForUser(userId);
  return ms.find((m) => m.member.role === "OWNER" && !m.organization.is_demo) ?? null;
}

const personal = z.object({ first_name: z.string().trim().min(1).max(60), last_name: z.string().trim().min(1).max(60), title: z.string().trim().max(80).optional() });
const organization = z.object({ name: z.string().trim().min(2, "Organization name is required.").max(120), industry: z.string().trim().max(120).optional() });
const constitutionFields = [
  "mission", "vision", "values", "business_model", "strategic_priorities", "current_priorities", "primary_audiences", "brand_voice",
  "financial_objectives", "technology_objectives", "impact_objectives", "decision_principles", "important_restrictions", "leadership_philosophy",
] as const;

export async function saveOnboardingStep(_: OnboardingState, fd: FormData): Promise<OnboardingState> {
  const user = await requireUser();
  const step = Number(fd.get("step"));
  try {
    if (step === 0) {
      const p = personal.parse(Object.fromEntries(fd));
      await updateProfile(user.id, { first_name: p.first_name, last_name: p.last_name });
      const m = await ownedOrg(user.id);
      if (m && p.title) await db().members.update(m.organization.id, m.member.id, { title: p.title });
      return { ok: true, step: 1 };
    }
    if (step === 1) {
      const o = organization.parse(Object.fromEntries(fd));
      const existing = await ownedOrg(user.id);
      if (!existing) {
        const org = await createOrganization({ name: o.name, industry: o.industry || null, owner: user, title: String(fd.get("title") ?? "") || null });
        (await cookies()).set(ORG_COOKIE, org.id, { httpOnly: true, sameSite: "lax", path: "/" });
      }
      return { ok: true, step: 2 };
    }
    const m = await ownedOrg(user.id);
    if (!m) return { error: "Create your organization first.", step: 1 };
    const patch: Partial<OrganizationConstitution> = { updated_at: nowIso() };
    for (const f of constitutionFields) {
      const v = fd.get(f);
      if (typeof v === "string") patch[f] = v.trim().slice(0, 4000);
    }
    const rt = fd.get("risk_tolerance");
    if (rt === "CONSERVATIVE" || rt === "BALANCED" || rt === "AGGRESSIVE") patch.risk_tolerance = rt;
    const c = await getConstitution(m.organization.id);
    await db().constitutions.update(m.organization.id, c.id, patch);
    return { ok: true, step: step + 1 };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Please check your entries.", step };
    console.error("[onboarding] step failed", err);
    return { error: "We couldn't save this step. Please try again.", step };
  }
}

/** Final step: seed initial C-Suite Memory from the Constitution and enter HQ. */
export async function completeOnboarding(): Promise<void> {
  const user = await requireUser();
  const m = await ownedOrg(user.id);
  if (!m) redirect("/onboarding");
  const orgId = m.organization.id;
  const c = await getConstitution(orgId);
  const seeds: [string, string, MemoryCategory][] = [
    ["Mission", c.mission, "COMPANY"],
    ["Vision", c.vision, "STRATEGY"],
    ["Business model", c.business_model, "COMPANY"],
    ["Strategic priorities", c.strategic_priorities, "STRATEGY"],
    ["Current priorities", c.current_priorities, "STRATEGY"],
    ["Primary audiences", c.primary_audiences, "BRAND"],
    ["Brand voice", c.brand_voice, "BRAND"],
    ["Financial objectives", c.financial_objectives, "FINANCE"],
    ["Technology objectives", c.technology_objectives, "TECHNOLOGY"],
    ["Impact objectives", c.impact_objectives, "IMPACT"],
  ];
  const now = nowIso();
  const existing = await db().memory.list(orgId, { where: { source_type: "IMPORT" }, limit: 1 });
  if (!existing.length) {
    await db().memory.insertMany(
      seeds
        .filter(([, v]) => v && v.trim())
        .map(([title, content, category]) => ({
          id: newId(), organization_id: orgId, project_id: null, title, content, category, importance: 4, status: "USER_CONFIRMED" as const, pinned: title === "Mission",
          source_type: "IMPORT" as const, source_id: c.id, created_by: user.id, verified_by: user.id, confidence: 1, embedding: lexicalEmbedding(`${title} ${content}`),
          visibility: "ORGANIZATION" as const, executive_relevance: [], created_at: now, updated_at: now,
        })),
    );
  }
  await updateProfile(user.id, { onboarding_completed: true });
  await audit(orgId, user.id, "constitution.update", "organization_constitution", c.id, { source: "onboarding" });
  await notify(orgId, user.id, "welcome", "Your C-Suite is convened", "All seven A.I. Executives have read your Organization Constitution.", "/executives");
  redirect("/hq");
}
