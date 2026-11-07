"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/server/organizations/service";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { db, newId, nowIso } from "@/server/db/store";
import { audit } from "@/server/audit";
import { SESSION_LIMITS } from "@/config/sessions/modes";
import { SESSION_MODES as MODES, type SessionMode } from "@/types/domain";

const Create = z.object({
  title: z.string().trim().min(3, "Give the session a title.").max(160),
  objective: z.string().trim().min(3, "Define the objective.").max(2000),
  mode: z.enum(MODES),
  participants: z.array(z.string().uuid()).min(2, "Select at least two executives.").max(SESSION_LIMITS.maxParticipants),
  chair: z.string().uuid().optional().or(z.literal("")),
  project_id: z.string().uuid().optional().or(z.literal("")),
  attachments: z.array(z.string().uuid()).max(5),
});

export async function createSessionAction(_: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  const ctx = await authorize("sessions.create");
  const parsed = Create.safeParse({
    title: fd.get("title"),
    objective: fd.get("objective"),
    mode: fd.get("mode"),
    participants: fd.getAll("participants").map(String),
    chair: fd.get("chair") ?? "",
    project_id: fd.get("project_id") ?? "",
    attachments: fd.getAll("attachments").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const p = parsed.data;
  const orgId = ctx.organization.id;
  const execs = await AIExecutiveRegistry.getAllExecutives(orgId);
  const valid = execs.filter((e) => p.participants.includes(e.id)).map((e) => e.id);
  if (valid.length < 2) return { error: "Select at least two executives." };
  const chair = execs.find((e) => e.id === p.chair) ?? execs.find((e) => e.role_code === "CEO");
  const project = p.project_id ? await db().projects.get(orgId, p.project_id) : null;
  const id = newId();
  await db().sessions.insert({
    id, organization_id: orgId, project_id: project?.id ?? null, created_by: ctx.user.id, title: p.title, objective: p.objective, mode: p.mode as SessionMode,
    status: "ACTIVE", chair_executive_id: chair?.id ?? null, participant_executive_ids: valid, created_at: nowIso(), started_at: null, ended_at: null,
  });
  const files = (await Promise.all(p.attachments.map((f) => db().files.get(orgId, f)))).filter(Boolean);
  await db().sessionMessages.insert({ id: newId(), organization_id: orgId, session_id: id, speaker_type: "SYSTEM", speaker_id: null, stage: "CONVENED", content: `Session convened · ${valid.length} executives${files.length ? ` · ${files.length} attachments` : ""}`, sequence_number: 0, provider: null, model: null, prompt_version: null, simulated: false, metadata: { attachment_ids: files.map((f) => f!.id) }, created_at: nowIso() });
  await audit(orgId, ctx.user.id, "session.create", "executive_session", id, { mode: p.mode, participants: valid.length });
  redirect(`/sessions/${id}?autostart=1`);
}

/** Compile minutes from the persisted transcript (deterministic — no model call). */
export async function createMinutesAction(sessionId: string) {
  const ctx = await authorize("reports.create");
  const orgId = ctx.organization.id;
  const s = await db().sessions.get(orgId, sessionId);
  if (!s) return;
  const msgs = await db().sessionMessages.list(orgId, { where: { session_id: s.id }, orderBy: "sequence_number" });
  const execs = new Map((await AIExecutiveRegistry.getAllExecutives(orgId)).map((e) => [e.id, e]));
  const body = [
    `# Minutes — ${s.title}`,
    `**Objective:** ${s.objective}`,
    `**Mode:** ${s.mode.replace(/_/g, " ")} · **Participants:** ${s.participant_executive_ids.map((id) => execs.get(id)?.short_title).filter(Boolean).join(", ")}`,
    ...msgs.filter((m) => m.speaker_type !== "SYSTEM").map((m) => `## ${m.speaker_type === "USER" ? "Leadership" : (execs.get(m.speaker_id ?? "")?.title ?? "Executive")} — ${m.stage.replace(/_/g, " ").toLowerCase()}\n${m.content}`),
  ].join("\n\n");
  const id = newId();
  const simulated = msgs.some((m) => m.simulated);
  await db().reports.insert({
    id, organization_id: orgId, project_id: s.project_id, report_type: "C-Suite Session Minutes", title: `Minutes — ${s.title}`, summary: `Minutes of the ${s.mode.replace(/_/g, " ").toLowerCase()} session.`,
    content: body, lead_executive_id: s.chair_executive_id ?? s.participant_executive_ids[0], contributing_executive_ids: s.participant_executive_ids, sources: [], version: 1,
    source_session_id: s.id, simulated, created_by: ctx.user.id, created_at: nowIso(),
  });
  await audit(orgId, ctx.user.id, "report.create", "report", id, { type: "minutes" });
  revalidatePath("/reports");
  redirect(`/reports/${id}`);
}

export async function createDecisionMemoAction(decisionId: string) {
  const ctx = await authorize("reports.create");
  const orgId = ctx.organization.id;
  const dcs = await db().decisions.get(orgId, decisionId);
  if (!dcs) return;
  const content = [
    `# Decision Memo — ${dcs.title}`,
    `**Question:** ${dcs.question}`,
    `## Recommendation\n${dcs.recommendation}`,
    dcs.rationale && `## Rationale\n${dcs.rationale}`,
    dcs.risks_json.length ? `## Risks\n| Risk | Severity |\n|---|---|\n${dcs.risks_json.map((r) => `| ${r.risk} | ${r.severity} |`).join("\n")}` : "",
    `## Confidence\n${Math.round(dcs.confidence * 100)}%`,
    `## Status\n${dcs.status}`,
  ].filter(Boolean).join("\n\n");
  const s = dcs.session_id ? await db().sessions.get(orgId, dcs.session_id) : null;
  const ceo = await AIExecutiveRegistry.getByRole(orgId, "CEO");
  const id = newId();
  await db().reports.insert({ id, organization_id: orgId, project_id: dcs.project_id, report_type: "Decision Memo", title: `Decision Memo — ${dcs.title}`, summary: dcs.recommendation.slice(0, 200), content, lead_executive_id: s?.chair_executive_id ?? ceo?.id ?? "", contributing_executive_ids: s?.participant_executive_ids ?? [], sources: [], version: 1, source_session_id: s?.id ?? null, simulated: false, created_by: ctx.user.id, created_at: nowIso() });
  await audit(orgId, ctx.user.id, "report.create", "report", id, { type: "decision_memo" });
  redirect(`/reports/${id}`);
}

export async function updateDecisionStatusAction(fd: FormData) {
  const ctx = await authorize("decisions.approve");
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["APPROVED", "REJECTED", "DEFERRED", "UNDER_REVIEW"].includes(status)) return;
  const decision = await db().decisions.get(ctx.organization.id, id);
  if (!decision) return;
  // Approving a vote's decision adopts the recommended option unless one was already chosen.
  const chosen = status === "APPROVED" && !decision.chosen_option && decision.recommended_option ? { chosen_option: decision.recommended_option } : {};
  await db().decisions.update(ctx.organization.id, id, { status: status as "APPROVED", ...chosen });
  await audit(ctx.organization.id, ctx.user.id, "approval.action", "decision", id, { status });
  revalidatePath("/decisions");
}
