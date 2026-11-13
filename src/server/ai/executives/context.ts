import "server-only";
import { db } from "@/server/db/store";
import { getConstitution } from "@/server/organizations/service";
import { retrieveMemory } from "@/server/memory/service";
import { approvedLessons } from "@/server/executives/learning";
import { retrieveLibrary } from "@/server/executives/library";
import { retrieveCompanyDocuments } from "@/server/files/company-documents";
import { PromptRegistry } from "../prompts/registry";
import { buildExecutivePrompt, resolveCore, type BuiltPrompt, type ContextBundle } from "../prompts/builders";
import type { Organization, ResolvedExecutive, Role } from "@/types/domain";

/**
 * Assembles layered context for one executive and one request. Retrieves only
 * what is relevant: top-k memory within the executive's permitted categories,
 * the most relevant passages of company documents (every executive), this
 * executive's own library, explicitly attached files, and the project in scope.
 */
export async function assembleExecutiveContext(args: {
  organization: Organization;
  viewerRole: Role;
  exec: ResolvedExecutive;
  query: string;
  projectId?: string | null;
  fileIds?: string[];
  taskInstructions?: string;
  /** True when the answer may use web research (see webResearchFor). */
  webResearch?: boolean;
}): Promise<BuiltPrompt & { memoryIds: string[]; libraryIds: string[]; lessonIds: string[]; documentFileIds: string[] }> {
  const orgId = args.organization.id;
  const d = db();
  const [constitution, memory, files, project, ceoIntelligence, platformRules, core, webResearchRules, lessons, library, companyDocuments] = await Promise.all([
    getConstitution(orgId),
    retrieveMemory({ organizationId: orgId, query: args.query, executiveRole: args.exec.role_code, allowedCategories: args.exec.model.memory_categories, projectId: args.projectId, viewerRole: args.viewerRole, limit: 8 }),
    Promise.all((args.fileIds ?? []).slice(0, 5).map((id) => d.files.get(orgId, id))),
    args.projectId ? d.projects.get(orgId, args.projectId) : Promise.resolve(null),
    args.exec.role_code === "CEO" ? d.ceoIntelligence.list(orgId, { where: { included: true }, limit: 20 }) : Promise.resolve([]),
    PromptRegistry.resolve(orgId, "platform_rules"),
    resolveCore(orgId, args.exec),
    args.webResearch ? PromptRegistry.resolve(orgId, "web_research_rules") : Promise.resolve(null),
    approvedLessons(orgId, args.exec.id),
    retrieveLibrary(orgId, args.exec, args.query),
    // Company-wide documents: every executive draws on them, whatever its memory areas.
    retrieveCompanyDocuments({ organizationId: orgId, query: args.query, viewerRole: args.viewerRole, excludeFileIds: args.fileIds }),
  ]);
  const ctx: ContextBundle = {
    organization: args.organization,
    constitution,
    memory: memory.map((m) => m.record),
    files: files.filter((f): f is NonNullable<typeof f> => Boolean(f)),
    project,
    ceoIntelligence,
    lessons,
    library,
    companyDocuments,
  };
  const built = buildExecutivePrompt({ platformRules, core, exec: args.exec, ctx, taskInstructions: args.taskInstructions, webResearchRules });
  return { ...built, memoryIds: memory.map((m) => m.record.id), libraryIds: library.map((l) => l.id), lessonIds: lessons.map((l) => l.id), documentFileIds: [...new Set(companyDocuments.map((c) => c.fileId))] };
}
