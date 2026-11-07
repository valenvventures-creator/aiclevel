import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { cancelSessionRun, startSessionRun } from "@/server/ai/orchestration/csuite-orchestrator";
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

/**
 * Starts a session round: records the question and the round's settings.
 * The executives then speak through bounded steps — POST /api/sessions/[id]/step.
 */
export const maxDuration = 60;

export async function POST(req: Request, { params }: RouteContext<"/api/sessions/[id]/run">) {
  try {
    const ctx = await authorize("sessions.create");
    const { id } = await params;
    const body = Body.parse(await req.json());
    if (!rateLimit(`session:${ctx.user.id}`, 10, 60_000).ok) return NextResponse.json({ error: "Too many session runs. Please wait a moment." }, { status: 429 });
    const session = await db().sessions.get(ctx.organization.id, id);
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    const convened = await db().sessionMessages.list(ctx.organization.id, { where: { session_id: id, stage: "CONVENED" }, limit: 1 });
    const attachmentIds = (convened[0]?.metadata?.attachment_ids as string[] | undefined) ?? [];
    const result = await startSessionRun({
      organization: ctx.organization,
      userId: ctx.user.id,
      sessionId: id,
      userMessage: body.message,
      mode: body.mode,
      participantExecutiveIds: body.participantIds,
      attachmentIds,
      options: { voteOptions: body.voteOptions, onlyExecutiveId: body.onlyExecutiveId },
    });
    if (result.state === "busy") return NextResponse.json({ error: result.error ?? "The executives are still answering the previous question. It will finish in a moment." }, { status: 409 });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    return apiError(err);
  }
}

/** Stops the current round. */
export async function DELETE(_: Request, { params }: RouteContext<"/api/sessions/[id]/run">) {
  try {
    const ctx = await authorize("sessions.create");
    const { id } = await params;
    const stopped = await cancelSessionRun({ organization: ctx.organization, userId: ctx.user.id, sessionId: id });
    return NextResponse.json({ stopped }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return apiError(err);
  }
}
