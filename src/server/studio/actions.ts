"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/server/organizations/service";
import { db, newId, nowIso } from "@/server/db/store";
import { STUDIO_CAPABILITIES } from "@/config/studio/capabilities";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { audit } from "@/server/audit";
import { createProductionJob, queueRetry, queueRevision } from "./service";
import { routeStudioRequest } from "./router";

export async function previewRouteAction(request: string) {
  await authorize("studio.request");
  const r = routeStudioRequest(request);
  return { key: r.capability.key, label: r.capability.label, lead: r.capability.lead, contributors: r.capability.contributors, artifact: r.capability.artifact_type, alternatives: r.alternatives.map((a) => ({ key: a.key, label: a.label, lead: a.lead })) };
}

const Submit = z.object({
  request: z.string().trim().min(8, "Describe what you need in a sentence or two.").max(6000),
  capability_key: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  project_id: z.string().uuid().optional().or(z.literal("")),
});

export async function submitStudioRequestAction(_: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  const ctx = await authorize("studio.request");
  const p = Submit.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const cap = STUDIO_CAPABILITIES.find((c) => c.key === p.data.capability_key)?.key;
  const job = await createProductionJob({ organization: ctx.organization, userId: ctx.user.id, request: p.data.request, capabilityKey: cap, priority: p.data.priority, projectId: p.data.project_id || null });
  // Production runs in bounded steps driven from the job page (see advanceProductionJob).
  redirect(`/studio/${job.id}`);
}

export async function requestRevisionAction(fd: FormData) {
  const ctx = await authorize("studio.request");
  const id = String(fd.get("id"));
  const note = String(fd.get("note") ?? "").trim().slice(0, 4000);
  if (!note) return;
  const job = await db().productionJobs.get(ctx.organization.id, id);
  if (!job) return;
  await queueRevision(ctx.organization.id, id, note);
  revalidatePath(`/studio/${id}`);
}

export async function retryJobAction(fd: FormData) {
  const ctx = await authorize("studio.request");
  const id = String(fd.get("id"));
  await queueRetry(ctx.organization.id, id);
  revalidatePath(`/studio/${id}`);
}

export async function approveJobAction(fd: FormData) {
  const ctx = await authorize("studio.request");
  const id = String(fd.get("id"));
  await db().productionJobs.update(ctx.organization.id, id, { status: "COMPLETED" });
  revalidatePath(`/studio/${id}`);
}

/** Save the latest Finished Work version as a Report. */
export async function saveAsReportAction(fd: FormData) {
  const ctx = await authorize("reports.create");
  const orgId = ctx.organization.id;
  const id = String(fd.get("id"));
  const job = await db().productionJobs.get(orgId, id);
  if (!job) return;
  const [art] = await db().artifacts.list(orgId, { where: { job_id: id }, orderBy: "version", desc: true, limit: 1 });
  if (!art) return;
  const cap = STUDIO_CAPABILITIES.find((c) => c.key === job.capability_key);
  const reportId = newId();
  await db().reports.insert({ id: reportId, organization_id: orgId, project_id: job.project_id, report_type: cap?.report_type ?? "CEO Executive Brief", title: job.title, summary: art.content.replace(/[#>*_|-]/g, "").slice(0, 220).trim(), content: art.content, lead_executive_id: job.lead_executive_id, contributing_executive_ids: job.contributor_executive_ids, sources: (Array.isArray(job.metadata?.sources) ? (job.metadata.sources as { url: string; title: string }[]) : []).map((s) => ({ label: s.title, url: s.url })), version: art.version, source_session_id: null, simulated: art.simulated, created_by: ctx.user.id, created_at: nowIso() });
  await audit(orgId, ctx.user.id, "report.create", "report", reportId, { from_job: id });
  redirect(`/reports/${reportId}`);
}

/** Send Finished Work to another executive for review via Executive Comms. */
export async function sendToExecutiveAction(fd: FormData) {
  const ctx = await authorize("comms.send");
  const orgId = ctx.organization.id;
  const job = await db().productionJobs.get(orgId, String(fd.get("id")));
  const exec = await AIExecutiveRegistry.getExecutive(orgId, String(fd.get("executive_id")));
  if (!job || !exec) return;
  redirect(`/comms?compose=1&to=${exec.id}`);
}
