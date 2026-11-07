import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { rateLimit } from "@/server/auth/rate-limit";
import { suggestVoteOptions } from "@/server/sessions/suggest-options";

const Body = z.object({ question: z.string().trim().min(3).max(8000) });

/** The chair drafts 2–4 ballot options for an Executive Vote; the person edits them before convening. */
export const maxDuration = 60;

export async function POST(req: Request, { params }: RouteContext<"/api/sessions/[id]/suggest-options">) {
  try {
    const ctx = await authorize("sessions.create");
    const { id } = await params;
    const body = Body.parse(await req.json());
    if (!rateLimit(`vote-options:${ctx.user.id}`, 10, 60_000).ok) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
    const result = await suggestVoteOptions({ organization: ctx.organization, userId: ctx.user.id, viewerRole: ctx.role, sessionId: id, question: body.question });
    return NextResponse.json(result, { status: result.error ? 422 : 200, headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Write your question first." }, { status: 400 });
    return apiError(err);
  }
}
