import "server-only";
import { aiGateway } from "@/server/ai/gateway";
import { fill, PromptRegistry } from "@/server/ai/prompts/registry";
import { db, newId, nowIso } from "@/server/db/store";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";
import type { AIExecutive, ExecutiveFeedback, ExecutiveLesson } from "@/types/domain";

/**
 * EXECUTIVE LEARNING — feedback becomes lessons.
 *
 * A person rates an executive's answer (👍/👎) and may say what it should have
 * said or done. A correction is distilled (fast utility model, through the
 * gateway) into a short, general lesson for that executive. A.I.-drafted
 * lessons are PROPOSED; only lessons a person approves are applied to future
 * answers. Lessons a person writes directly are approved on creation.
 */
export const LESSON_LIMITS = { APPLIED_PER_ANSWER: 20, CHAR_BUDGET: 5000, COMMENT_CHARS: 2000, GUIDANCE_CHARS: 1200 } as const;

export interface FeedbackInput {
  organizationId: string;
  userId: string;
  executiveId: string;
  sourceType: ExecutiveFeedback["source_type"];
  sourceId: string;
  rating: ExecutiveFeedback["rating"];
  comment: string;
}

/** The rated answer and the question it answered, checked against the organization, executive and (for private conversations) the person. */
async function loadRatedAnswer(input: FeedbackInput): Promise<{ answer: string; question: string } | null> {
  const d = db();
  if (input.sourceType === "CONVERSATION") {
    const msg = await d.messages.get(input.organizationId, input.sourceId);
    if (!msg || msg.role !== "executive") return null;
    const conv = await d.conversations.get(input.organizationId, msg.conversation_id);
    if (!conv || conv.executive_id !== input.executiveId || conv.user_id !== input.userId) return null;
    const history = await d.messages.list(input.organizationId, { where: { conversation_id: conv.id }, orderBy: "created_at" });
    const idx = history.findIndex((m) => m.id === msg.id);
    const question = [...history.slice(0, Math.max(0, idx))].reverse().find((m) => m.role === "user")?.content ?? "";
    return { answer: msg.content, question };
  }
  const msg = await d.sessionMessages.get(input.organizationId, input.sourceId);
  if (!msg || msg.speaker_type !== "EXECUTIVE" || msg.speaker_id !== input.executiveId) return null;
  const all = await d.sessionMessages.list(input.organizationId, { where: { session_id: msg.session_id }, orderBy: "sequence_number" });
  const question = [...all].filter((m) => m.sequence_number < msg.sequence_number && m.stage === "QUESTION").at(-1)?.content ?? "";
  return { answer: msg.content, question };
}

export type FeedbackResult = { ok: true; feedbackId: string; lesson: ExecutiveLesson | null } | { ok: false; error: string };

export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const d = db();
  const rated = await loadRatedAnswer(input);
  if (!rated) return { ok: false, error: "That answer could not be found." };
  const exec = await d.executives.get(input.organizationId, input.executiveId);
  if (!exec) return { ok: false, error: "Executive not found." };
  const comment = input.comment.trim().slice(0, LESSON_LIMITS.COMMENT_CHARS);

  // One rating per person per answer: rating again replaces it.
  const [existing] = await d.feedback.list(input.organizationId, { where: { source_id: input.sourceId, created_by: input.userId }, limit: 1 });
  const feedbackId = existing?.id ?? newId();
  const row: ExecutiveFeedback = { id: feedbackId, organization_id: input.organizationId, executive_id: exec.id, source_type: input.sourceType, source_id: input.sourceId, rating: input.rating, comment, lesson_id: existing?.lesson_id ?? null, created_by: input.userId, created_at: existing?.created_at ?? nowIso() };
  if (existing) await d.feedback.update(input.organizationId, feedbackId, row);
  else await d.feedback.insert(row);
  await audit(input.organizationId, input.userId, "executive.feedback", "ai_executive", exec.id, { rating: input.rating, source: input.sourceType, with_comment: Boolean(comment) });

  // Only a written correction (or note on what worked) teaches a lesson; a bare rating is recorded.
  if (!comment || row.lesson_id) return { ok: true, feedbackId, lesson: null };
  const draft = await draftLesson({ organizationId: input.organizationId, userId: input.userId, exec, rating: input.rating, comment, ...rated });
  const now = nowIso();
  const lesson: ExecutiveLesson = { id: newId(), organization_id: input.organizationId, executive_id: exec.id, title: draft.title, guidance: draft.guidance, status: "PROPOSED", origin: "FEEDBACK", source_feedback_id: feedbackId, created_by: input.userId, approved_by: null, created_at: now, updated_at: now };
  await d.lessons.insert(lesson);
  await d.feedback.update(input.organizationId, feedbackId, { lesson_id: lesson.id });
  await notifyAdmins(input.organizationId, `New lesson to review for the ${exec.title}`, `“${lesson.title}” was drafted from feedback. Approve it to apply it to future answers.`, `/executives/${exec.slug}?tab=learning`);
  return { ok: true, feedbackId, lesson };
}

/** Distils feedback into one short, general lesson. Falls back to the person's own words if the model cannot. */
export async function draftLesson(args: { organizationId: string; userId: string; exec: Pick<AIExecutive, "id" | "title" | "role_code">; rating: "UP" | "DOWN"; comment: string; question: string; answer: string }): Promise<{ title: string; guidance: string }> {
  const fallback = { title: titleFrom(args.comment), guidance: (args.rating === "DOWN" ? args.comment : `Keep doing this: ${args.comment}`).slice(0, LESSON_LIMITS.GUIDANCE_CHARS) };
  try {
    const tpl = await PromptRegistry.resolve(args.organizationId, "lesson_from_feedback");
    const system = fill(tpl.content, {
      executive: args.exec.title,
      rating: args.rating === "DOWN" ? "unhelpful or wrong" : "helpful",
      question: args.question.slice(0, 2000),
      answer: args.answer.slice(0, 4000),
      comment: args.comment,
    });
    const out = await aiGateway.generate({ organizationId: args.organizationId, userId: args.userId, executiveId: args.exec.id, executiveRole: args.exec.role_code, taskType: "lesson_drafting", system, messages: [{ role: "user", content: "Write the lesson." }], promptVersion: tpl.versionTag });
    const parsed = parseLesson(out.text);
    return parsed ?? fallback;
  } catch (err) {
    console.error("[learning] lesson drafting failed; using the person's words", err);
    return fallback;
  }
}

export function parseLesson(text: string): { title: string; guidance: string } | null {
  const title = text.match(/^\s*TITLE:\s*(.+)$/im)?.[1]?.trim();
  const guidance = text.match(/^\s*LESSON:\s*([\s\S]+)$/im)?.[1]?.trim();
  if (!title || !guidance) return null;
  return { title: title.replace(/^["“]|["”]$/g, "").slice(0, 160), guidance: guidance.slice(0, LESSON_LIMITS.GUIDANCE_CHARS) };
}

function titleFrom(comment: string): string {
  const first = comment.split(/[.!?\n]/)[0]?.trim() || comment;
  return first.length > 80 ? `${first.slice(0, 77)}…` : first;
}

async function notifyAdmins(orgId: string, title: string, message: string, url: string) {
  const members = await db().members.list(orgId);
  await Promise.all(members.filter((m) => (m.role === "OWNER" || m.role === "ADMIN") && m.status === "ACTIVE").map((m) => notify(orgId, m.user_id, "learning.lesson_proposed", title, message, url)));
}

/** Approved lessons for one executive, newest first, within the per-answer bounds. */
export async function approvedLessons(orgId: string, executiveId: string): Promise<ExecutiveLesson[]> {
  try {
    const rows = await db().lessons.list(orgId, { where: { executive_id: executiveId, status: "APPROVED" } });
    const sorted = rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const out: ExecutiveLesson[] = [];
    let used = 0;
    for (const l of sorted) {
      if (out.length >= LESSON_LIMITS.APPLIED_PER_ANSWER) break;
      const size = l.title.length + l.guidance.length;
      if (used + size > LESSON_LIMITS.CHAR_BUDGET) break;
      out.push(l);
      used += size;
    }
    return out;
  } catch (err) {
    console.error("[learning] could not load lessons; answering without them", err);
    return [];
  }
}

export async function createLesson(orgId: string, userId: string, executiveId: string, title: string, guidance: string): Promise<ExecutiveLesson> {
  const now = nowIso();
  // Written by a person, so it applies straight away.
  const lesson: ExecutiveLesson = { id: newId(), organization_id: orgId, executive_id: executiveId, title: title.trim().slice(0, 160), guidance: guidance.trim().slice(0, LESSON_LIMITS.GUIDANCE_CHARS), status: "APPROVED", origin: "MANUAL", source_feedback_id: null, created_by: userId, approved_by: userId, created_at: now, updated_at: now };
  await db().lessons.insert(lesson);
  await audit(orgId, userId, "executive.lesson", "executive_lesson", lesson.id, { action: "create", executive_id: executiveId });
  return lesson;
}

export async function setLessonStatus(orgId: string, userId: string, lessonId: string, status: "APPROVED" | "ARCHIVED", edits?: { title?: string; guidance?: string }): Promise<ExecutiveLesson | null> {
  const lesson = await db().lessons.get(orgId, lessonId);
  if (!lesson) return null;
  const patch: Partial<ExecutiveLesson> = {
    status,
    updated_at: nowIso(),
    ...(status === "APPROVED" ? { approved_by: userId } : {}),
    ...(edits?.title?.trim() ? { title: edits.title.trim().slice(0, 160) } : {}),
    ...(edits?.guidance?.trim() ? { guidance: edits.guidance.trim().slice(0, LESSON_LIMITS.GUIDANCE_CHARS) } : {}),
  };
  await db().lessons.update(orgId, lessonId, patch);
  await audit(orgId, userId, "executive.lesson", "executive_lesson", lessonId, { action: status === "APPROVED" ? "approve" : "archive", edited: Boolean(edits?.title || edits?.guidance) });
  return { ...lesson, ...patch };
}
