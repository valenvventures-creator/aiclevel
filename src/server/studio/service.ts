import "server-only";
import { STUDIO_CAPABILITIES } from "@/config/studio/capabilities";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { db, newId, nowIso } from "@/server/db/store";
import { audit } from "@/server/audit";
import { aiGateway } from "@/server/ai/gateway";
import { fill, PromptRegistry } from "@/server/ai/prompts/registry";
import { assembleExecutiveContext } from "@/server/ai/executives/context";
import { notify } from "@/server/notifications";
import type { Organization, ProductionJob, ProviderId, Role } from "@/types/domain";
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

/* -------------------------------------------------------------------------- */
/* Stepwise production                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Hosting platforms cap each request (Netlify: 60 s, including work scheduled
 * after the response). A full deliverable from a high-reasoning model takes
 * longer, so Finished Work is produced in bounded STEPS:
 *
 *   - each step holds a short lease so only one runner works on a job at a time;
 *   - it streams for at most STEP_BUDGET_MS, saving the draft as it goes;
 *   - if the model has not finished, the next step continues from the saved draft;
 *   - hard bounds (MAX_STEPS, MAX_EMPTY_STEPS) make runaway loops impossible.
 *
 * The job page drives steps via POST /api/studio/[id]/advance while it is open.
 */
export const STUDIO_LIMITS = {
  STEP_BUDGET_MS: 42_000,
  LEASE_MS: 58_000,
  MAX_STEPS: 14,
  MAX_EMPTY_STEPS: 2,
  DRAFT_SAVE_EVERY_MS: 4_000,
  MAX_DRAFT_CHARS: 120_000,
} as const;

export const WORKING_STATUSES: ProductionJob["status"][] = ["QUEUED", "ROUTING", "IN_PROGRESS", "REVISION_REQUESTED"];

interface StepMeta {
  draft?: string;
  steps?: number;
  empty_steps?: number;
  lease_until?: string | null;
  pending_revision?: string | null;
  error?: string;
  [k: string]: unknown;
}

export type AdvanceResult =
  | { state: "done" }
  | { state: "continue"; draftChars: number }
  | { state: "busy" }
  | { state: "failed"; error: string }
  | { state: "idle" };

/** Queue a revision: the next steps rewrite the latest version using the note. */
export async function queueRevision(orgId: string, jobId: string, note: string) {
  const job = await db().productionJobs.get(orgId, jobId);
  if (!job) return;
  const meta = (job.metadata ?? {}) as StepMeta;
  await db().productionJobs.update(orgId, jobId, { status: "REVISION_REQUESTED", metadata: { ...meta, pending_revision: note, draft: "", steps: 0, empty_steps: 0, lease_until: null, error: undefined } });
}

/** Reset a failed job so the next steps start over. */
export async function queueRetry(orgId: string, jobId: string) {
  const job = await db().productionJobs.get(orgId, jobId);
  if (!job) return;
  const meta = (job.metadata ?? {}) as StepMeta;
  await db().productionJobs.update(orgId, jobId, { status: job.status === "FAILED" ? "QUEUED" : job.status, metadata: { ...meta, draft: "", steps: 0, empty_steps: 0, lease_until: null, error: undefined } });
}

export async function advanceProductionJob(args: { organization: Organization; userId: string; viewerRole: Role; jobId: string; budgetMs?: number }): Promise<AdvanceResult> {
  const orgId = args.organization.id;
  const d = db();
  const job = await d.productionJobs.get(orgId, args.jobId);
  if (!job) return { state: "failed", error: "Job not found." };
  if (!WORKING_STATUSES.includes(job.status)) return { state: "idle" };

  const meta = (job.metadata ?? {}) as StepMeta;
  if (meta.lease_until && new Date(meta.lease_until).getTime() > Date.now()) return { state: "busy" };

  const steps = (meta.steps ?? 0) + 1;
  const fail = async (error: string): Promise<AdvanceResult> => {
    await d.productionJobs.update(orgId, job.id, { status: "FAILED", metadata: { ...meta, steps, lease_until: null, error } });
    return { state: "failed", error };
  };
  if (steps > STUDIO_LIMITS.MAX_STEPS) return fail("The work exceeded the maximum length for one piece of Finished Work. Try a narrower request.");

  // Take the lease before any slow work.
  const leaseUntil = new Date(Date.now() + STUDIO_LIMITS.LEASE_MS).toISOString();
  await d.productionJobs.update(orgId, job.id, { status: job.status === "QUEUED" || job.status === "ROUTING" ? "IN_PROGRESS" : job.status, started_at: job.started_at ?? nowIso(), metadata: { ...meta, steps, lease_until: leaseUntil } });

  const lead = await AIExecutiveRegistry.resolve(orgId, job.lead_executive_id);
  if (!lead) return fail("The lead executive is no longer available.");
  const contributors = await AIExecutiveRegistry.resolveMany(orgId, job.contributor_executive_ids);
  const prior = (await d.artifacts.list(orgId, { where: { job_id: job.id }, orderBy: "version", desc: true, limit: 1 }))[0];
  const revisionNote = job.status === "REVISION_REQUESTED" ? (meta.pending_revision ?? null) : null;
  const draft = meta.draft ?? "";

  const tpl = await PromptRegistry.resolve(orgId, "studio_production");
  const task = fill(tpl.content, {
    artifact_type: job.artifact_type,
    request: job.request,
    contributors: contributors.map((c) => `${c.title} (${c.persona.primary_question})`).join("; ") || "none",
    revision: revisionNote && prior ? `REVISION REQUEST: ${revisionNote}\nRevise the previous version below accordingly.\n<retrieved_content>\n${prior.content.slice(0, 20000)}\n</retrieved_content>` : "",
  });
  const built = await assembleExecutiveContext({ organization: args.organization, viewerRole: args.viewerRole, exec: lead, query: job.request, projectId: job.project_id, taskInstructions: task });

  // Continuation steps see the draft so far and must only add to it.
  const userContent = draft
    ? `${job.request}\n\n<draft_so_far>\n${draft.slice(-60_000)}\n</draft_so_far>\n\nThe deliverable above is unfinished. Continue it from exactly where the draft ends. Output only the continuation — do not repeat any text already written, do not restart, and do not add commentary.`
    : job.request;

  const ctrl = new AbortController();
  const budget = args.budgetMs ?? STUDIO_LIMITS.STEP_BUDGET_MS;
  const timer = setTimeout(() => ctrl.abort(), budget);
  let added = "";
  let finished = false;
  let error: string | null = null;
  let provider: ProviderId | null = null;
  let model: string | null = null;
  let simulated = false;
  let lastSave = Date.now();
  try {
    for await (const c of aiGateway.stream({
      organizationId: orgId,
      userId: args.userId,
      executiveId: lead.id,
      executiveRole: lead.role_code,
      taskType: "studio_production",
      system: built.system,
      messages: [{ role: "user", content: userContent }],
      // Medium effort keeps time-to-first-text inside one step; later steps only continue writing.
      modelPreference: { provider: lead.model.primary_provider, model: lead.model.primary_model, fallbackProvider: lead.model.fallback_provider, fallbackModel: lead.model.fallback_model, effort: draft || (meta.empty_steps ?? 0) > 0 ? "low" : "medium" },
      promptVersion: tpl.versionTag,
      signal: ctrl.signal,
    })) {
      if (c.type === "meta" && c.provider) {
        provider = c.provider;
        model = c.model ?? null;
        simulated = Boolean(c.simulated);
      } else if (c.type === "text" && c.text) {
        added += c.text;
        if (Date.now() - lastSave > STUDIO_LIMITS.DRAFT_SAVE_EVERY_MS) {
          lastSave = Date.now();
          await d.productionJobs.update(orgId, job.id, { metadata: { ...meta, steps, lease_until: leaseUntil, draft: draft + added } });
        }
      } else if (c.type === "done") finished = c.stopReason !== "max_tokens";
      else if (c.type === "error") error = c.error ?? "Unknown error";
    }
  } finally {
    clearTimeout(timer);
  }

  const full = (draft + added).slice(0, STUDIO_LIMITS.MAX_DRAFT_CHARS);
  if (error && !added) return fail(error);

  if (finished && !ctrl.signal.aborted) {
    await d.artifacts.insert({ id: newId(), organization_id: orgId, job_id: job.id, version: (prior?.version ?? 0) + 1, artifact_type: job.artifact_type, content: full, file_id: null, revision_note: revisionNote, simulated, created_at: nowIso() });
    await d.productionJobs.update(orgId, job.id, { status: "AWAITING_REVIEW", provider, model, completed_at: nowIso(), metadata: { ...meta, steps, draft: "", empty_steps: 0, lease_until: null, pending_revision: null, error: undefined } });
    if (revisionNote) await audit(orgId, args.userId, "studio.revision", "production_job", job.id, {});
    await notify(orgId, args.userId, "studio.finished", "Finished Work ready", `${lead.title} completed "${job.title}".`, `/studio/${job.id}`);
    return { state: "done" };
  }

  // Not finished within this step: keep the draft and release the lease.
  const empty = added.trim() ? 0 : (meta.empty_steps ?? 0) + 1;
  if (empty >= STUDIO_LIMITS.MAX_EMPTY_STEPS) {
    return fail(`${lead.title} did not produce any text within the hosting time limit. Retry, or lower this executive's reasoning effort in Settings → A.I. C-Suite.`);
  }
  await d.productionJobs.update(orgId, job.id, { provider, model, metadata: { ...meta, steps, draft: full, empty_steps: empty, lease_until: null } });
  return { state: "continue", draftChars: full.length };
}
