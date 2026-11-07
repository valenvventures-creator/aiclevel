import "server-only";
import { dataMode } from "@/lib/env";
import { db, memoryTables, newId, nowIso } from "@/server/db/store";
import { supabaseAdmin } from "@/server/db/supabase";
import { generateToken, hashToken } from "@/server/auth/password";
import { assignableRoles } from "@/server/auth/permissions";
import { demoIdentity } from "@/server/auth/identity";
import { audit } from "@/server/audit";
import type { Invitation, Organization, Role, UserProfile } from "@/types/domain";

const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;

export async function createInvitation(args: { organization: Organization; actor: UserProfile; actorRole: Role; email: string; role: Role }): Promise<{ invitation: Invitation; token: string }> {
  if (!assignableRoles(args.actorRole).includes(args.role)) throw new Error("You cannot assign that role.");
  if (!args.actor.email_verified) throw new Error("Verify your email before inviting team members.");
  const { token, hash } = generateToken();
  const invitation: Invitation = {
    id: newId(),
    organization_id: args.organization.id,
    email: args.email.toLowerCase(),
    role: args.role,
    token_hash: hash,
    invited_by: args.actor.id,
    expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    accepted_at: null,
    created_at: nowIso(),
  };
  await db().invitations.insert(invitation);
  await audit(args.organization.id, args.actor.id, "team.invite", "invitation", invitation.id, { role: args.role });
  // Email delivery is handled by the configured mail provider (see docs/AUTHENTICATION.md).
  return { invitation, token };
}

/** Looks up an invitation by raw token. The token alone determines the organization. */
export async function findInvitation(token: string): Promise<(Invitation & { organization_name: string }) | null> {
  const hash = hashToken(token);
  let inv: Invitation | null = null;
  if (dataMode() === "supabase") {
    const { data } = await supabaseAdmin().from("invitations").select("*").eq("token_hash", hash).maybeSingle();
    inv = (data as Invitation) ?? null;
  } else {
    inv = ([...(memoryTables.get("invitations")?.values() ?? [])] as unknown as Invitation[]).find((i) => i.token_hash === hash) ?? null;
  }
  if (!inv) return null;
  let orgName = "an organization";
  if (dataMode() === "supabase") {
    const { data } = await supabaseAdmin().from("organizations").select("name").eq("id", inv.organization_id).maybeSingle();
    orgName = (data?.name as string) ?? orgName;
  } else orgName = demoIdentity.getOrganization(inv.organization_id)?.name ?? orgName;
  return { ...inv, organization_name: orgName };
}

export type AcceptResult = { ok: true; organizationId: string } | { ok: false; reason: "INVALID" | "EXPIRED" | "USED" | "EMAIL_MISMATCH" };

export async function acceptInvitation(token: string, user: UserProfile): Promise<AcceptResult> {
  const inv = await findInvitation(token);
  if (!inv) return { ok: false, reason: "INVALID" };
  if (inv.accepted_at) return { ok: false, reason: "USED" };
  if (new Date(inv.expires_at).getTime() < Date.now()) return { ok: false, reason: "EXPIRED" };
  if (inv.email !== user.email.toLowerCase()) return { ok: false, reason: "EMAIL_MISMATCH" };

  // Membership is created ONLY for the invitation's own organization.
  const member = { id: newId(), organization_id: inv.organization_id, user_id: user.id, role: inv.role, title: null, status: "ACTIVE" as const, created_at: nowIso() };
  if (dataMode() === "supabase") {
    const admin = supabaseAdmin();
    const { error } = await admin.rpc("accept_invitation", { p_token_hash: inv.token_hash, p_user_id: user.id });
    if (error) return { ok: false, reason: "INVALID" };
  } else {
    const existing = await db().members.list(inv.organization_id, { where: { user_id: user.id } });
    if (!existing.length) await db().members.insert(member);
    await db().invitations.update(inv.organization_id, inv.id, { accepted_at: nowIso() });
    demoIdentity.updateProfile(user.id, { onboarding_completed: true });
  }
  await audit(inv.organization_id, user.id, "team.invite_accepted", "invitation", inv.id, { role: inv.role });
  return { ok: true, organizationId: inv.organization_id };
}
