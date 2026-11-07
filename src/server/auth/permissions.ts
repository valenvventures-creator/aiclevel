import type { Role } from "@/types/domain";

/**
 * Role-based authorization. Never use a boolean `isAdmin` flag.
 * Every server action and route handler checks a named capability.
 */
export const CAPABILITIES = [
  "org.read",
  "org.update",
  "org.delete",
  "org.transfer_ownership",
  "billing.manage",
  "team.read",
  "team.invite",
  "team.change_role",
  "team.remove",
  "executives.use",
  "executives.configure",
  "prompts.publish",
  "models.configure",
  "credentials.manage",
  "tools.configure",
  "integrations.manage",
  "conversations.create",
  "comms.send",
  "sessions.create",
  "sessions.read",
  "memory.read",
  "memory.write",
  "memory.verify",
  "memory.delete",
  "files.read",
  "files.upload",
  "files.delete",
  "reports.read",
  "reports.create",
  "reports.delete",
  "projects.read",
  "projects.manage",
  "studio.request",
  "decisions.approve",
  "approvals.review",
  "audit.read",
  "ceo_intelligence.manage",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const READ: Capability[] = ["org.read", "team.read", "sessions.read", "memory.read", "files.read", "reports.read", "projects.read"];
const COLLABORATE: Capability[] = [...READ, "executives.use", "conversations.create", "comms.send", "sessions.create", "memory.write", "files.upload", "reports.create", "studio.request"];
const OPERATE: Capability[] = [...COLLABORATE, "memory.verify", "projects.manage", "decisions.approve", "approvals.review", "files.delete", "memory.delete", "reports.delete"];
const ADMINISTER: Capability[] = [
  ...OPERATE,
  "org.update",
  "team.invite",
  "team.change_role",
  "team.remove",
  "executives.configure",
  "prompts.publish",
  "models.configure",
  "credentials.manage",
  "tools.configure",
  "integrations.manage",
  "audit.read",
];

export const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  OWNER: new Set<Capability>([...ADMINISTER, "org.delete", "org.transfer_ownership", "billing.manage", "ceo_intelligence.manage"]),
  ADMIN: new Set<Capability>(ADMINISTER),
  EXECUTIVE: new Set<Capability>(OPERATE),
  MEMBER: new Set<Capability>(COLLABORATE),
  ADVISOR: new Set<Capability>([...READ.filter((c) => c !== "team.read"), "executives.use", "conversations.create", "comms.send"]),
  VIEWER: new Set<Capability>(READ),
};

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

/** Roles an actor may assign. Only OWNER can create other OWNERs/ADMINs. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "OWNER") return ["ADMIN", "EXECUTIVE", "MEMBER", "ADVISOR", "VIEWER"];
  if (actor === "ADMIN") return ["EXECUTIVE", "MEMBER", "ADVISOR", "VIEWER"];
  return [];
}

export class AuthorizationError extends Error {
  constructor(public readonly capability: Capability) {
    super(`Not authorized: ${capability}`);
    this.name = "AuthorizationError";
  }
}

export function assertCan(role: Role, capability: Capability): void {
  if (!can(role, capability)) throw new AuthorizationError(capability);
}

/**
 * Reports: operators (Owner, Admin, Executive) may delete any report in the
 * organization; anyone who can create reports may delete the ones they created.
 */
export function canDeleteReport(role: Role, userId: string, report: { created_by: string }): boolean {
  return can(role, "reports.delete") || (can(role, "reports.create") && report.created_by === userId);
}
