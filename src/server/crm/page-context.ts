import "server-only";
import { can } from "@/server/auth/permissions";
import { listTeam, requireContext } from "@/server/organizations/service";

/** Context for CRM pages: the signed-in person, what they may do, and the team (deal and contact owners). */
export async function crmPageContext() {
  const ctx = await requireContext();
  const allowed = can(ctx.role, "crm.read");
  const team = allowed ? await listTeam(ctx.organization.id) : [];
  const owners = team
    .filter((m) => m.status === "ACTIVE")
    .map((m) => ({ id: m.user_id, name: m.profile ? m.profile.display_name || `${m.profile.first_name} ${m.profile.last_name}`.trim() || m.profile.email : "Team member", email: m.profile?.email ?? "" }));
  return {
    ctx,
    allowed,
    canWrite: can(ctx.role, "crm.write"),
    canDelete: can(ctx.role, "crm.delete"),
    canTransfer: can(ctx.role, "crm.transfer"),
    owners,
  };
}

export type CrmOwner = Awaited<ReturnType<typeof crmPageContext>>["owners"][number];
