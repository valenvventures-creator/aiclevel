import "server-only";
import { db } from "@/server/db/store";
import { getConstitution } from "@/server/organizations/service";
import { retrieveMemory } from "@/server/memory/service";
import { PromptRegistry } from "../prompts/registry";
import { buildExecutivePrompt, resolveCore, type BuiltPrompt, type ContextBundle } from "../prompts/builders";
import type { Organization, ResolvedExecutive, Role } from "@/types/domain";

/**
 * Assembles layered context for one executive and one request. Retrieves only
 * what is relevant: top-k memory within the executive's permitted categories,
 * explicitly attached files, and the project in scope.
 */
export async function assembleExecutiveContext(args: {
  organization: Organization;
  viewerRole: Role;
  exec: ResolvedExecutive;
  query: string;
  projectId?: string | null;
  fileIds?: string[];
  taskInstructions?: string;
}): Promise<BuiltPrompt & { memoryIds: string[] }> {
  const orgId = args.organization.id;
  const d = db();
  const [constitution, memory, files, project, ceoIntelligence, platformRules, core] = await Promise.all([
    getConstitution(orgId),
    retrieveMemory({ organizationId: orgId, query: args.query, executiveRole: args.exec.role_code, allowedCategories: args.exec.model.memory_categories, projectId: args.projectId, viewerRole: args.viewerRole, limit: 8 }),
    Promise.all((args.fileIds ?? []).slice(0, 5).map((id) => d.files.get(orgId, id))),
    args.projectId ? d.projects.get(orgId, args.projectId) : Promise.resolve(null),
    args.exec.role_code === "CEO" ? d.ceoIntelligence.list(orgId, { where: { included: true }, limit: 20 }) : Promise.resolve([]),
    PromptRegistry.resolve(orgId, "platform_rules"),
    resolveCore(orgId, args.exec),
  ]);
  const ctx: ContextBundle = {
    organization: args.organization,
    constitution,
    memory: memory.map((m) => m.record),
    files: files.filter((f): f is NonNullable<typeof f> => Boolean(f)),
    project,
    ceoIntelligence,
  };
  const built = buildExecutivePrompt({ platformRules, core, exec: args.exec, ctx, taskInstructions: args.taskInstructions });
  return { ...built, memoryIds: memory.map((m) => m.record.id) };
}
