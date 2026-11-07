"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/server/organizations/service";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { db, newId, nowIso } from "@/server/db/store";
import { audit } from "@/server/audit";
import { generateExecutiveReplies } from "./service";

const Send = z.object({
  thread_id: z.string().uuid().optional().or(z.literal("")),
  subject: z.string().trim().min(1, "Add a subject.").max(200),
  body: z.string().trim().min(1, "Write a message.").max(20000),
  recipients: z.array(z.string()).min(1, "Choose at least one recipient."),
  intent: z.enum(["send", "draft"]),
  origin_type: z.enum(["FILE", "REPORT", "CONVERSATION", "SESSION", "MEMORY", "PROJECT", "TEMPLATE", ""]).optional(),
  origin_id: z.string().optional(),
});

export interface ComposeState {
  error?: string;
}

export async function sendCommunicationAction(_: ComposeState, fd: FormData): Promise<ComposeState> {
  const ctx = await authorize("comms.send");
  const parsed = Send.safeParse({
    thread_id: fd.get("thread_id") ?? undefined,
    subject: fd.get("subject"),
    body: fd.get("body"),
    recipients: fd.getAll("recipients").map(String),
    intent: fd.get("intent") === "draft" ? "draft" : "send",
    origin_type: fd.get("origin_type") ?? "",
    origin_id: fd.get("origin_id") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the message." };
  const p = parsed.data;
  const orgId = ctx.organization.id;
  // Recipients are validated against this organization's executives and members — never trusted from the browser.
  const execIds = new Set((await AIExecutiveRegistry.getAllExecutives(orgId)).map((e) => e.id));
  const memberIds = new Set((await db().members.list(orgId)).map((m) => m.user_id));
  const recipient_executive_ids = p.recipients.includes("ALL") ? [...execIds] : p.recipients.filter((r) => execIds.has(r));
  const recipient_user_ids = p.recipients.filter((r) => memberIds.has(r) && r !== ctx.user.id);
  if (!recipient_executive_ids.length && !recipient_user_ids.length) return { error: "Choose at least one valid recipient." };

  let threadId = p.thread_id || newId();
  if (p.thread_id) {
    const existing = await db().communications.list(orgId, { where: { thread_id: p.thread_id }, limit: 1 });
    if (!existing.length) threadId = newId();
  }
  const comm = {
    id: newId(), organization_id: orgId, thread_id: threadId, subject: p.subject, body: p.body, sender_type: "USER" as const, sender_id: ctx.user.id,
    recipient_executive_ids, recipient_user_ids, is_draft: p.intent === "draft", starred: false, archived: false, read_at: nowIso(),
    origin_type: (p.origin_type || null) as never, origin_id: p.origin_id || null, simulated: false, created_at: nowIso(),
  };
  await db().communications.insert(comm);
  if (p.intent === "send") {
    await audit(orgId, ctx.user.id, "comms.send", "communication", comm.id, { executives: recipient_executive_ids.length, humans: recipient_user_ids.length });
    if (recipient_executive_ids.length) after(() => generateExecutiveReplies({ organization: ctx.organization, userId: ctx.user.id, viewerRole: ctx.role, communication: comm }));
  }
  revalidatePath("/comms");
  redirect(p.intent === "draft" ? "/comms?folder=DRAFTS" : `/comms?folder=SENT&thread=${threadId}`);
}

export async function updateCommunicationAction(fd: FormData) {
  const ctx = await authorize("comms.send");
  const id = String(fd.get("id") ?? "");
  const op = String(fd.get("op") ?? "");
  const orgId = ctx.organization.id;
  const c = await db().communications.get(orgId, id);
  if (!c) return;
  const thread = await db().communications.list(orgId, { where: { thread_id: c.thread_id } });
  for (const m of thread) {
    if (op === "star") await db().communications.update(orgId, m.id, { starred: !c.starred });
    if (op === "archive") await db().communications.update(orgId, m.id, { archived: !c.archived });
    if (op === "read") await db().communications.update(orgId, m.id, { read_at: m.read_at ?? nowIso() });
  }
  revalidatePath("/comms");
}

export async function deleteDraftAction(fd: FormData) {
  const ctx = await authorize("comms.send");
  const id = String(fd.get("id") ?? "");
  const c = await db().communications.get(ctx.organization.id, id);
  if (c?.is_draft && c.sender_id === ctx.user.id) await db().communications.remove(ctx.organization.id, id);
  revalidatePath("/comms");
}
