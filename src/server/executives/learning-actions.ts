"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/server/organizations/service";
import { rateLimit } from "@/server/auth/rate-limit";
import { db } from "@/server/db/store";
import { audit } from "@/server/audit";
import { deleteFile } from "@/server/files/service";
import type { SettingsState } from "@/server/settings/actions";
import { createLesson, setLessonStatus, submitFeedback } from "./learning";
import { addLibraryItem, deleteLibraryItem, LIBRARY_LIMITS, updateLibraryItem } from "./library";

/**
 * Server actions for executive learning (feedback → lessons) and the
 * Executive Library. Rating answers needs "executives.use"; approving
 * lessons and curating the library needs "executives.configure".
 */

const fail = (e: unknown): SettingsState => ({ error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Invalid input.") : e instanceof Error ? e.message : "Something went wrong." });

/** The executive must belong to the caller's organization; returns it for paths and messages. */
async function ownExecutive(orgId: string, executiveId: string) {
  const exec = await db().executives.get(orgId, executiveId);
  if (!exec) throw new Error("Executive not found.");
  return exec;
}

/* -------------------------------- Feedback -------------------------------- */

const Feedback = z.object({
  executiveId: z.string().uuid(),
  sourceType: z.enum(["CONVERSATION", "SESSION"]),
  sourceId: z.string().uuid(),
  rating: z.enum(["UP", "DOWN"]),
  comment: z.string().max(2000).default(""),
});

export async function submitFeedbackAction(input: z.input<typeof Feedback>): Promise<{ ok: boolean; error?: string; lessonTitle?: string }> {
  try {
    const ctx = await authorize("executives.use");
    if (!rateLimit(`feedback:${ctx.user.id}`, 30, 60_000).ok) return { ok: false, error: "Too many ratings at once. Please wait a moment." };
    const p = Feedback.parse(input);
    const r = await submitFeedback({ organizationId: ctx.organization.id, userId: ctx.user.id, executiveId: p.executiveId, sourceType: p.sourceType, sourceId: p.sourceId, rating: p.rating, comment: p.comment });
    if (!r.ok) return { ok: false, error: r.error };
    const exec = await db().executives.get(ctx.organization.id, p.executiveId);
    if (exec) revalidatePath(`/executives/${exec.slug}`);
    return { ok: true, lessonTitle: r.lesson?.title };
  } catch (e) {
    return { ok: false, error: fail(e).error };
  }
}

/* --------------------------------- Lessons -------------------------------- */

const LessonText = z.object({
  title: z.string().trim().min(3, "Give the lesson a short title.").max(160),
  guidance: z.string().trim().min(10, "Write the lesson (at least a sentence).").max(1200),
});

export async function createLessonAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    const ctx = await authorize("executives.configure");
    const exec = await ownExecutive(ctx.organization.id, String(fd.get("executive_id")));
    const p = LessonText.parse({ title: fd.get("title"), guidance: fd.get("guidance") });
    await createLesson(ctx.organization.id, ctx.user.id, exec.id, p.title, p.guidance);
    revalidatePath(`/executives/${exec.slug}`);
    return { ok: true, message: `Lesson added. The ${exec.title} applies it from now on.` };
  } catch (e) {
    return fail(e);
  }
}

/** Approve (optionally with edits) or archive a lesson. */
export async function reviewLessonAction(fd: FormData) {
  const ctx = await authorize("executives.configure");
  const lesson = await db().lessons.get(ctx.organization.id, String(fd.get("id")));
  if (!lesson) return;
  const exec = await ownExecutive(ctx.organization.id, lesson.executive_id);
  const decision = String(fd.get("decision"));
  if (decision !== "APPROVED" && decision !== "ARCHIVED") return;
  const title = String(fd.get("title") ?? "");
  const guidance = String(fd.get("guidance") ?? "");
  if (decision === "APPROVED" && (title || guidance)) LessonText.partial().parse({ title: title || undefined, guidance: guidance || undefined });
  await setLessonStatus(ctx.organization.id, ctx.user.id, lesson.id, decision, { title, guidance });
  revalidatePath(`/executives/${exec.slug}`);
}

/* --------------------------------- Library -------------------------------- */

const LibraryText = z.object({
  kind: z.enum(["FRAMEWORK", "PLAYBOOK", "REFERENCE"]),
  title: z.string().trim().min(3, "Give it a title.").max(160),
  content: z.string().trim().min(20, "Add the content (at least a couple of sentences).").max(LIBRARY_LIMITS.ITEM_CHARS),
});

export async function addLibraryItemAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    const ctx = await authorize("executives.configure");
    const exec = await ownExecutive(ctx.organization.id, String(fd.get("executive_id")));
    const p = LibraryText.parse({ kind: fd.get("kind"), title: fd.get("title"), content: fd.get("content") });
    const item = await addLibraryItem(ctx.organization.id, ctx.user.id, exec.id, p);
    await audit(ctx.organization.id, ctx.user.id, "executive.library", "executive_library_item", item.id, { action: "add", kind: p.kind, executive_id: exec.id });
    revalidatePath(`/executives/${exec.slug}`);
    return { ok: true, message: `Added for the ${exec.short_title} only.` };
  } catch (e) {
    return fail(e);
  }
}

export async function updateLibraryItemAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  try {
    const ctx = await authorize("executives.configure");
    const item = await db().library.get(ctx.organization.id, String(fd.get("id")));
    if (!item) return { error: "Item not found." };
    const exec = await ownExecutive(ctx.organization.id, item.executive_id);
    const p = LibraryText.parse({ kind: fd.get("kind") ?? (item.kind === "DOCUMENT" ? "REFERENCE" : item.kind), title: fd.get("title"), content: fd.get("content") });
    await updateLibraryItem(ctx.organization.id, item.id, { ...p, kind: item.kind === "DOCUMENT" ? "DOCUMENT" : p.kind });
    await audit(ctx.organization.id, ctx.user.id, "executive.library", "executive_library_item", item.id, { action: "edit" });
    revalidatePath(`/executives/${exec.slug}`);
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleLibraryItemAction(fd: FormData) {
  const ctx = await authorize("executives.configure");
  const item = await db().library.get(ctx.organization.id, String(fd.get("id")));
  if (!item) return;
  const exec = await ownExecutive(ctx.organization.id, item.executive_id);
  await updateLibraryItem(ctx.organization.id, item.id, { enabled: !item.enabled });
  await audit(ctx.organization.id, ctx.user.id, "executive.library", "executive_library_item", item.id, { action: item.enabled ? "turn_off" : "turn_on" });
  revalidatePath(`/executives/${exec.slug}`);
}

export async function deleteLibraryItemAction(fd: FormData) {
  const ctx = await authorize("executives.configure");
  const item = await db().library.get(ctx.organization.id, String(fd.get("id")));
  if (!item) return;
  const exec = await ownExecutive(ctx.organization.id, item.executive_id);
  if (await deleteLibraryItem(ctx.organization.id, item.id)) {
    // A document uploaded privately for this executive is removed with its library item.
    const file = item.file_id ? await db().files.get(ctx.organization.id, item.file_id) : null;
    if (file && file.executive_id === item.executive_id) await deleteFile(file);
    await audit(ctx.organization.id, ctx.user.id, "executive.library", "executive_library_item", item.id, { action: "delete", ...(file ? { file_id: file.id } : {}) });
  }
  revalidatePath(`/executives/${exec.slug}`);
}
