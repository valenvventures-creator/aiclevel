import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, ndjson } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { db, newId, nowIso } from "@/server/db/store";
import { aiGateway } from "@/server/ai/gateway";
import { assembleExecutiveContext } from "@/server/ai/executives/context";
import { rateLimit } from "@/server/auth/rate-limit";
import type { ChatMessage } from "@/server/ai/gateway/types";

const Body = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(20000),
  fileIds: z.array(z.string().uuid()).max(5).optional(),
  projectId: z.string().uuid().nullable().optional(),
  regenerate: z.boolean().optional(),
});

const HISTORY_TURNS = 12;

export async function POST(req: Request, { params }: RouteContext<"/api/executives/[slug]/chat">) {
  try {
    const ctx = await authorize("conversations.create");
    const { slug } = await params;
    const body = Body.parse(await req.json());
    if (!rateLimit(`chat:${ctx.user.id}`, 30, 60_000).ok) return NextResponse.json({ error: "You're sending messages too quickly." }, { status: 429 });
    const orgId = ctx.organization.id;
    const exec = await AIExecutiveRegistry.resolve(orgId, slug);
    if (!exec || !exec.is_active) return NextResponse.json({ error: "Executive not found." }, { status: 404 });
    const d = db();

    // Conversation must belong to this org, this executive and this user.
    let conversation = body.conversationId ? await d.conversations.get(orgId, body.conversationId) : null;
    if (conversation && (conversation.executive_id !== exec.id || conversation.user_id !== ctx.user.id)) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    if (!conversation) {
      conversation = { id: newId(), organization_id: orgId, executive_id: exec.id, user_id: ctx.user.id, project_id: body.projectId ?? null, title: body.message.slice(0, 80), created_at: nowIso(), updated_at: nowIso() };
      await d.conversations.insert(conversation);
    }

    let history = await d.messages.list(orgId, { where: { conversation_id: conversation.id }, orderBy: "created_at" });
    if (body.regenerate) {
      const last = history[history.length - 1];
      if (last?.role === "executive") {
        await d.messages.remove(orgId, last.id);
        history = history.slice(0, -1);
      }
    } else {
      const userMsg = { id: newId(), organization_id: orgId, conversation_id: conversation.id, role: "user" as const, content: body.message, provider: null, model: null, prompt_version: null, simulated: false, created_at: nowIso() };
      await d.messages.insert(userMsg);
      history.push(userMsg);
    }

    // Recent relevant conversation only — never the full history.
    const recent: ChatMessage[] = history.slice(-HISTORY_TURNS * 2).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
    while (recent.length && recent[0].role !== "user") recent.shift();

    const built = await assembleExecutiveContext({ organization: ctx.organization, viewerRole: ctx.role, exec, query: body.message, projectId: conversation.project_id, fileIds: body.fileIds });
    const abort = new AbortController();
    req.signal.addEventListener("abort", () => abort.abort());
    const conversationId = conversation.id;

    async function* run() {
      yield { type: "conversation", conversationId, memoryUsed: built.memoryIds.length, layers: built.layers };
      let text = "";
      let provider: string | null = null;
      let model: string | null = null;
      let simulated = false;
      let failed = false;
      await d.executives.update(orgId, exec!.id, { status: "WORKING" });
      try {
        for await (const c of aiGateway.stream({
          organizationId: orgId,
          userId: ctx.user.id,
          executiveId: exec!.id,
          executiveRole: exec!.role_code,
          taskType: "executive_conversation",
          system: built.system,
          messages: recent,
          modelPreference: { provider: exec!.model.primary_provider, model: exec!.model.primary_model, fallbackProvider: exec!.model.fallback_provider, fallbackModel: exec!.model.fallback_model, effort: exec!.model.effort },
          promptVersion: built.promptVersion,
          signal: abort.signal,
        })) {
          if (c.type === "meta" && c.provider) {
            provider = c.provider;
            model = c.model ?? null;
            simulated = Boolean(c.simulated);
            yield { type: "meta", provider, model, simulated };
          } else if (c.type === "meta" && c.text) yield { type: "notice", text: c.text };
          else if (c.type === "text" && c.text) {
            text += c.text;
            yield { type: "delta", text: c.text };
          } else if (c.type === "error") {
            failed = true;
            yield { type: "error", error: c.error };
          }
        }
      } finally {
        await d.executives.update(orgId, exec!.id, { status: "AVAILABLE" });
        if (text.trim()) {
          const stopped = abort.signal.aborted;
          const id = newId();
          await d.messages.insert({ id, organization_id: orgId, conversation_id: conversationId, role: "executive", content: stopped ? `${text}\n\n_— response stopped_` : text, provider: (provider as "anthropic" | "openai" | "simulated" | null) ?? null, model, prompt_version: built.promptVersion, simulated, created_at: nowIso() });
          await d.conversations.update(orgId, conversationId, { updated_at: nowIso() });
          if (!failed) yield { type: "done", messageId: id };
        }
      }
    }
    return ndjson(run(), () => abort.abort());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    return apiError(err);
  }
}
