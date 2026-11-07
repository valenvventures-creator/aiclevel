"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/server/organizations/service";
import { db, newId, nowIso } from "@/server/db/store";
import { lexicalEmbedding } from "./embeddings";
import { audit } from "@/server/audit";
import { EXECUTIVE_ROLE_CODES, MEMORY_CATEGORIES } from "@/types/domain";

const Upsert = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(2, "Add a title.").max(160),
  content: z.string().trim().min(2, "Add the content.").max(8000),
  category: z.enum(MEMORY_CATEGORIES),
  importance: z.coerce.number().int().min(1).max(5),
  visibility: z.enum(["ORGANIZATION", "LEADERSHIP", "OWNER_ONLY"]),
  project_id: z.string().uuid().optional().or(z.literal("")),
  executive_relevance: z.array(z.enum(EXECUTIVE_ROLE_CODES)).default([]),
});

export async function upsertMemoryAction(_: { error?: string; ok?: boolean }, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const ctx = await authorize("memory.write");
  const parsed = Upsert.safeParse({ ...Object.fromEntries(fd), executive_relevance: fd.getAll("executive_relevance").map(String) });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const p = parsed.data;
  const orgId = ctx.organization.id;
  if (p.visibility === "OWNER_ONLY" && ctx.role !== "OWNER") return { error: "Only the Owner can create owner-only memory." };
  const now = nowIso();
  if (p.id) {
    const existing = await db().memory.get(orgId, p.id);
    if (!existing) return { error: "Memory not found." };
    await db().memory.update(orgId, p.id, { title: p.title, content: p.content, category: p.category, importance: p.importance, visibility: p.visibility, project_id: p.project_id || null, executive_relevance: p.executive_relevance, embedding: lexicalEmbedding(`${p.title} ${p.content}`), updated_at: now, status: existing.status === "VERIFIED" ? "USER_CONFIRMED" : existing.status });
    await audit(orgId, ctx.user.id, "memory.edit", "memory_record", p.id, {});
  } else {
    const id = newId();
    // Human-entered memory is USER_CONFIRMED; it can be promoted to VERIFIED by an authorized reviewer.
    await db().memory.insert({ id, organization_id: orgId, project_id: p.project_id || null, title: p.title, content: p.content, category: p.category, importance: p.importance, status: "USER_CONFIRMED", pinned: false, source_type: "HUMAN_ENTRY", source_id: null, created_by: ctx.user.id, verified_by: null, confidence: 0.9, embedding: lexicalEmbedding(`${p.title} ${p.content}`), visibility: p.visibility, executive_relevance: p.executive_relevance, created_at: now, updated_at: now });
    await audit(orgId, ctx.user.id, "memory.create", "memory_record", id, { source: "human" });
  }
  revalidatePath("/memory");
  return { ok: true };
}

export async function memoryOpAction(fd: FormData) {
  const op = String(fd.get("op"));
  const id = String(fd.get("id"));
  const ctx = await authorize(op === "delete" ? "memory.delete" : op === "verify" ? "memory.verify" : "memory.write");
  const orgId = ctx.organization.id;
  const m = await db().memory.get(orgId, id);
  if (!m) return;
  if (op === "verify") {
    await db().memory.update(orgId, id, { status: "VERIFIED", verified_by: ctx.user.id, confidence: Math.max(m.confidence, 0.95), updated_at: nowIso() });
    await audit(orgId, ctx.user.id, "memory.verify", "memory_record", id, {});
  } else if (op === "pin") await db().memory.update(orgId, id, { pinned: !m.pinned });
  else if (op === "archive") {
    await db().memory.update(orgId, id, { status: m.status === "ARCHIVED" ? "USER_CONFIRMED" : "ARCHIVED", updated_at: nowIso() });
    await audit(orgId, ctx.user.id, "memory.archive", "memory_record", id, {});
  } else if (op === "delete") {
    await db().memory.remove(orgId, id);
    await audit(orgId, ctx.user.id, "memory.delete", "memory_record", id, { title: m.title });
  }
  revalidatePath("/memory");
}
