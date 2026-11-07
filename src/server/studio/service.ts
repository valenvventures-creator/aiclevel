import "server-only";
import { STUDIO_CAPABILITIES } from "@/config/studio/capabilities";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { db, newId, nowIso } from "@/server/db/store";
import { audit } from "@/server/audit";
import { aiGateway } from "@/server/ai/gateway";
import { fill, PromptRegistry } from "@/server/ai/prompts/registry";
import { assembleExecutiveContext } from "@/server/ai/executives/context";
import { notify } from "@/server/notifications";
import type { Organization, ProductionJob, Role } from "@/types/domain";
import { deriveTitle, routeStudioRequest } from "./router";

export async function createProductionJob(args: { organization: Organization; userId: string; request: string; capabilityKey?: string; priority?: ProductionJob["priority"]; projectId?: string | null }): Promise<ProductionJob> {
  const orgId = args.organization.id;
  const routed = routeStudioRequest(args.request);
  const cap = STUDIO_CAPABILITIES.find((c) => c.key === args.capabilityKey) ?? routed.capability;
  const lead = await AIExecutiveRegistry.getByRole(orgId, cap.lead);
  const contributors = (await Promise.all(cap.contributors.map((r) => AIExecutiveRegistry.getByRole(orgId, r)))).filter(Boolean);
  if (!lead) throw new Error("Lead executive not found");
  const job: ProductionJob = {
    id: newId(),
    organization_id: orgId,
    project_id: args.projectId ?? null,
    requested_by: args.userId,
    request: args.request,
    title: deriveTitle(args.request),
    artifact_type: cap.artifact_type,
    capability_key: cap.key,
    lead_executive_id: lead.id,
    contributor_executive_ids: contributors.map((c) => c!.id),
    status: "QUEUED",
    priority: args.priority ?? "NORMAL",
    provider: null,
    model: null,
    created_at: nowIso(),
    started_at: null,
    completed_at: null,
    metadata: { routed_score: routed.score },
  };
  await db().productionJobs.insert(job);
  await audit(orgId, args.userId, "studio.job_create", "production_job", job.id, { capability: cap.key });
  return job;
}

/** Produces (or revises) Finished Work for a job. Bounded: one generation per call. */
export async function runProductionJob(args: { organization: Organization; userId: string; viewerRole: Role; jobId: string; revisionNote?: string }) {
  const orgId = args.organization.id;
  const d = db();
  const job = await d.productionJobs.get(orgId, args.jobId);
  if (!job) throw new Error("Job not found");
  const lead = await AIExecutiveRegistry.resolve(orgId, job.lead_executive_id);
  if (!lead) throw new Error("Lead executive not found");
  const contributors = await AIExecutiveRegistry.resolveMany(orgId, job.contributor_executive_ids);
  await d.productionJobs.update(orgId, job.id, { status: "IN_PROGRESS", started_at: job.started_at ?? nowIso() });

  const prior = (await d.artifacts.list(orgId, { where: { job_id: job.id }, orderBy: "version", desc: true, limit: 1 }))[0];
  const tpl = await PromptRegistry.resolve(orgId, "studio_production");
  const task = fill(tpl.content, {
    artifact_type: job.artifact_type,
    request: job.request,
    contributors: contributors.map((c) => `${c.title} (${c.persona.primary_question})`).join("; ") || "none",
    revision: args.revisionNote && prior ? `REVISION REQUEST: ${args.revisionNote}\nRevise the previous version below accordingly.\n<retrieved_content>\n${prior.content.slice(0, 20000)}\n</retrieved_content>` : "",
  });
  const built = await assembleExecutiveContext({ organization: args.organization, viewerRole: args.viewerRole, exec: lead, query: job.request, projectId: job.project_id, taskInstructions: task });
  const out = await aiGateway.generate({
    organizationId: orgId,
    userId: args.userId,
    executiveId: lead.id,
    executiveRole: lead.role_code,
    taskType: "studio_production",
    system: built.system,
    messages: [{ role: "user", content: job.request }],
    modelPreference: { provider: lead.model.primary_provider, model: lead.model.primary_model, fallbackProvider: lead.model.fallback_provider, fallbackModel: lead.model.fallback_model, effort: lead.model.effort },
    promptVersion: tpl.versionTag,
  });
  if (out.error || !out.text.trim()) {
    await d.productionJobs.update(orgId, job.id, { status: "FAILED", metadata: { ...job.metadata, error: out.error } });
    return { ok: false as const, error: out.error ?? "Empty output" };
  }
  await d.artifacts.insert({ id: newId(), organization_id: orgId, job_id: job.id, version: (prior?.version ?? 0) + 1, artifact_type: job.artifact_type, content: out.text, file_id: null, revision_note: args.revisionNote ?? null, simulated: out.simulated, created_at: nowIso() });
  await d.productionJobs.update(orgId, job.id, { status: "AWAITING_REVIEW", provider: out.provider, model: out.model, completed_at: nowIso() });
  if (args.revisionNote) await audit(orgId, args.userId, "studio.revision", "production_job", job.id, {});
  await notify(orgId, args.userId, "studio.finished", "Finished Work ready", `${lead.title} completed "${job.title}".`, `/studio/${job.id}`);
  return { ok: true as const };
}
