import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, ndjson } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { runCSuiteSession } from "@/server/ai/orchestration/csuite-orchestrator";
import { rateLimit } from "@/server/auth/rate-limit";
import { db } from "@/server/db/store";
import { SESSION_MODES } from "@/types/domain";

const Body = z.object({
  message: z.string().trim().min(1).max(8000),
  mode: z.enum(SESSION_MODES).optional(),
  participantIds: z.array(z.string().uuid()).max(7).optional(),
  onlyExecutiveId: z.string().uuid().optional(),
  voteOptions: z.array(z.object({ id: z.string().max(8), label: z.string().max(200) })).max(6).optional(),
});

export const maxDuration = 300;

export async function POST(req: Request, { params }: RouteContext<"/api/sessions/[id]/run">) {
  try {
    const ctx = await authorize("sessions.create");
    const { id } = await params;
    const body = Body.parse(await req.json());
    if (!rateLimit(`session:${ctx.user.id}`, 10, 60_000).ok) return NextResponse.json({ error: "Too many session runs. Please wait a moment." }, { status: 429 });
    const session = await db().sessions.get(ctx.organization.id, id);
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (session.status === "RUNNING") return NextResponse.json({ error: "This session is already running." }, { status: 409 });
    const convened = await db().sessionMessages.list(ctx.organization.id, { where: { session_id: id, stage: "CONVENED" }, limit: 1 });
    const attachmentIds = (convened[0]?.metadata?.attachment_ids as string[] | undefined) ?? [];
    const abort = new AbortController();
    req.signal.addEventListener("abort", () => abort.abort());
    const gen = runCSuiteSession({
      organization: ctx.organization,
      userId: ctx.user.id,
      viewerRole: ctx.role,
      sessionId: id,
      userMessage: body.message,
      mode: body.mode,
      participantExecutiveIds: body.participantIds?.filter((p) => session.participant_executive_ids.includes(p)),
      attachmentIds,
      options: { voteOptions: body.voteOptions, onlyExecutiveId: body.onlyExecutiveId },
      signal: abort.signal,
    });
    async function* guarded() {
      try {
        yield* gen;
      } finally {
        const s = await db().sessions.get(ctx.organization.id, id);
        if (s?.status === "RUNNING") await db().sessions.update(ctx.organization.id, id, { status: "ACTIVE" });
      }
    }
    return ndjson(guarded(), () => abort.abort());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    return apiError(err);
  }
}
