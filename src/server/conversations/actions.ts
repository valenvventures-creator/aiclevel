"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/server/organizations/service";
import { db, newId, nowIso } from "@/server/db/store";
import { lexicalEmbedding } from "@/server/memory/embeddings";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { generateExecutiveReplies } from "@/server/comms/service";
import { audit } from "@/server/audit";
import type { MemoryCategory } from "@/types/domain";
import { MEMORY_CATEGORIES } from "@/types/domain";

/** Save an executive message to C-Suite Memory as PROPOSED (AI conclusions are never auto-verified). */
export async function saveMessageToMemoryAction(messageId: string, category: MemoryCategory = "STRATEGY") {
  const ctx = await authorize("memory.write");
  const orgId = ctx.organization.id;
  const msg = await db().messages.get(orgId, messageId);
  if (!msg) return { ok: false as const, error: "Message not found." };
  const conv = await db().conversations.get(orgId, msg.conversation_id);
  if (!conv || conv.user_id !== ctx.user.id) return { ok: false as const, error: "Message not found." };
  const exec = await AIExecutiveRegistry.getExecutive(orgId, conv.executive_id);
  const content = msg.content.slice(0, 4000);
  const id = newId();
  await db().memory.insert({
    id, organization_id: orgId, project_id: conv.project_id, title: `${exec?.short_title ?? "Executive"}: ${conv.title}`.slice(0, 120), content,
    category: MEMORY_CATEGORIES.includes(category) ? category : "STRATEGY", importance: 3, status: "PROPOSED", pinned: false,
    source_type: "EXECUTIVE_CONVERSATION", source_id: conv.id, created_by: ctx.user.id, verified_by: null, confidence: 0.6,
    embedding: lexicalEmbedding(content), visibility: "ORGANIZATION", executive_relevance: exec ? [exec.role_code] : [], created_at: nowIso(), updated_at: nowIso(),
  });
  await audit(orgId, ctx.user.id, "memory.create", "memory_record", id, { source: "conversation" });
  revalidatePath("/memory");
  return { ok: true as const };
}

const ForwardSchema = z.object({ messageId: z.string().uuid(), executiveIds: z.array(z.string().uuid()).min(1).max(7), note: z.string().max(2000).optional() });

/** Forward an executive's message to other executives via Executive Comms. */
export async function forwardToExecutivesAction(input: z.infer<typeof ForwardSchema>) {
  const ctx = await authorize("comms.send");
  const p = ForwardSchema.parse(input);
  const orgId = ctx.organization.id;
  const msg = await db().messages.get(orgId, p.messageId);
  if (!msg) return { ok: false as const };
  const conv = await db().conversations.get(orgId, msg.conversation_id);
  if (!conv || conv.user_id !== ctx.user.id) return { ok: false as const };
  const valid = (await AIExecutiveRegistry.getAllExecutives(orgId)).filter((e) => p.executiveIds.includes(e.id)).map((e) => e.id);
  const comm = {
    id: newId(), organization_id: orgId, thread_id: newId(), subject: `Fwd: ${conv.title}`.slice(0, 160),
    body: `${p.note ? `${p.note}\n\n` : ""}> Forwarded from a conversation:\n\n${msg.content}`, sender_type: "USER" as const, sender_id: ctx.user.id,
    recipient_executive_ids: valid, recipient_user_ids: [], is_draft: false, starred: false, archived: false, read_at: nowIso(),
    origin_type: "CONVERSATION" as const, origin_id: conv.id, simulated: false, created_at: nowIso(),
  };
  await db().communications.insert(comm);
  after(() => generateExecutiveReplies({ organization: ctx.organization, userId: ctx.user.id, viewerRole: ctx.role, communication: comm }));
  return { ok: true as const, threadId: comm.thread_id };
}

/** Bring a conversation to a new C-Suite Session. */
export async function bringToSessionAction(conversationId: string) {
  const ctx = await authorize("sessions.create");
  const conv = await db().conversations.get(ctx.organization.id, conversationId);
  if (!conv || conv.user_id !== ctx.user.id) redirect("/sessions/new");
  redirect(`/sessions/new?objective=${encodeURIComponent(conv.title)}&from=${conv.id}`);
}

export async function deleteConversationAction(conversationId: string) {
  const ctx = await authorize("conversations.create");
  const orgId = ctx.organization.id;
  const conv = await db().conversations.get(orgId, conversationId);
  if (!conv || conv.user_id !== ctx.user.id) return;
  const msgs = await db().messages.list(orgId, { where: { conversation_id: conv.id } });
  await Promise.all(msgs.map((m) => db().messages.remove(orgId, m.id)));
  await db().conversations.remove(orgId, conv.id);
  revalidatePath("/executives");
}
