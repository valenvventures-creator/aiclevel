import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { dataMode } from "@/lib/env";
import { slugify } from "@/lib/utils";
import { db, findRowsGlobally, newId, nowIso } from "@/server/db/store";
import { supabaseServer } from "@/server/db/supabase";
import { demoIdentity } from "@/server/auth/identity";
import { ORG_COOKIE, requireUser } from "@/server/auth/session";
import { assertCan, type Capability } from "@/server/auth/permissions";
import { seedExecutivesForOrganization } from "@/server/executives/seed";
import { audit } from "@/server/audit";
import type { Organization, OrganizationConstitution, OrganizationMember, Role, UserProfile } from "@/types/domain";

export interface Membership {
  organization: Organization;
  member: OrganizationMember;
}

export async function listMembershipsForUser(userId: string): Promise<Membership[]> {
  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    const { data, error } = await sb.from("organization_members").select("*, organization:organizations(*)").eq("user_id", userId).eq("status", "ACTIVE");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const { organization, ...member } = r as OrganizationMember & { organization: Organization };
      return { organization, member };
    });
  }
  const rows = await findRowsGlobally<OrganizationMember>("organization_members", { user_id: userId, status: "ACTIVE" });
  rows.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  const out: Membership[] = [];
  for (const member of rows) {
    const organization = await demoIdentity.getOrganization(member.organization_id);
    if (organization) out.push({ member, organization });
  }
  return out;
}

export interface RequestContext {
  user: UserProfile;
  organization: Organization;
  member: OrganizationMember;
  role: Role;
  memberships: Membership[];
}

/**
 * THE tenant boundary. Resolves the signed-in user and the organization they
 * are acting in from server-verified membership. The org cookie is only a
 * *preference* and is ignored unless the user is an active member.
 */
export const requireContext = cache(async (): Promise<RequestContext> => {
  const user = await requireUser();
  const memberships = await listMembershipsForUser(user.id);
  if (!memberships.length) redirect("/onboarding");
  const preferred = (await cookies()).get(ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.organization.id === preferred) ?? memberships[0];
  return { user, organization: active.organization, member: active.member, role: active.member.role, memberships };
});

/** requireContext + capability check (throws AuthorizationError). */
export async function authorize(capability: Capability): Promise<RequestContext> {
  const ctx = await requireContext();
  assertCan(ctx.role, capability);
  return ctx;
}

export function blankConstitution(organization_id: string): OrganizationConstitution {
  return {
    id: newId(),
    organization_id,
    mission: "", vision: "", values: "", business_model: "", leadership_philosophy: "",
    strategic_priorities: "", current_priorities: "", risk_tolerance: "BALANCED", brand_voice: "",
    primary_audiences: "", financial_objectives: "", technology_objectives: "", impact_objectives: "",
    key_relationships: "", important_restrictions: "", decision_principles: "", operating_philosophy: "",
    updated_at: nowIso(),
  };
}

export async function createOrganization(input: { name: string; industry?: string | null; owner: UserProfile; title?: string | null; isDemo?: boolean; id?: string }): Promise<Organization> {
  let slug = slugify(input.name) || "organization";
  const org: Organization = {
    id: input.id ?? newId(),
    name: input.name,
    slug,
    logo_url: null,
    owner_id: input.owner.id,
    industry: input.industry ?? null,
    subscription_status: "TRIAL",
    is_demo: Boolean(input.isDemo),
    created_at: nowIso(),
  };
  const member: OrganizationMember = { id: newId(), organization_id: org.id, user_id: input.owner.id, role: "OWNER", title: input.title ?? null, status: "ACTIVE", created_at: nowIso() };

  if (dataMode() === "supabase") {
    // Bootstrap RPC creates organization + OWNER membership atomically (SECURITY DEFINER, auth.uid() checked).
    const sb = await supabaseServer();
    const { data, error } = await sb.rpc("create_organization", { p_name: input.name, p_slug: `${slug}-${org.id.slice(0, 6)}`, p_industry: input.industry ?? null, p_title: input.title ?? null });
    if (error) throw new Error(error.message);
    org.id = data as string;
    org.slug = `${slug}-${org.id.slice(0, 6)}`;
  } else {
    if (await demoIdentity.slugTaken(slug)) slug = `${slug}-${org.id.slice(0, 6)}`;
    org.slug = slug;
    if (!(await demoIdentity.insertOrganizationIfAbsent(org))) {
      // Another request created it first (e.g. concurrent demo seeding) — reuse it.
      const existing = await demoIdentity.getOrganization(org.id);
      if (existing) return existing;
      org.slug = `${slugify(input.name) || "organization"}-${org.id.slice(0, 6)}`;
      if (!(await demoIdentity.insertOrganizationIfAbsent(org))) throw new Error("Organization could not be created");
    }
    await db().members.insert(member);
  }
  await db().constitutions.insert(blankConstitution(org.id));
  await seedExecutivesForOrganization(org.id);
  await audit(org.id, input.owner.id, "org.create", "organization", org.id, { name: org.name });
  return org;
}

export async function getConstitution(orgId: string): Promise<OrganizationConstitution> {
  const [row] = await db().constitutions.list(orgId, { limit: 1 });
  return row ?? blankConstitution(orgId);
}

export async function updateOrganizationRecord(orgId: string, patch: Partial<Organization>) {
  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    const { error } = await sb.from("organizations").update(patch).eq("id", orgId);
    if (error) throw new Error(error.message);
    return;
  }
  await demoIdentity.updateOrganization(orgId, patch);
}

export async function listTeam(orgId: string): Promise<(OrganizationMember & { profile: UserProfile | null })[]> {
  const members = await db().members.list(orgId, { orderBy: "created_at" });
  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    const { data } = await sb.from("profiles").select("*").in("id", members.map((m) => m.user_id));
    const byId = new Map((data ?? []).map((p) => [p.id as string, p as UserProfile]));
    return members.map((m) => ({ ...m, profile: byId.get(m.user_id) ?? null }));
  }
  const profiles = await demoIdentity.getUsers(members.map((m) => m.user_id));
  return members.map((m) => ({ ...m, profile: profiles.get(m.user_id) ?? null }));
}
